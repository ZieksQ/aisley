<?php

namespace App\Services\Messaging\Media;

use Illuminate\Validation\ValidationException;
use ZipArchive;

class ChatDocumentInspector
{
    public function inspect(string $path, string $extension, string $mime): void
    {
        if ($extension === 'pdf') {
            $bytes = file_get_contents($path);
            // Decode PDF name escapes before checking forbidden dictionary keys.
            $names = preg_replace_callback('/#([a-f0-9]{2})/i', fn ($match) => chr(hexdec($match[1])), $bytes);
            $valid = $mime === 'application/pdf' && preg_match('/^%PDF-(1\.[0-9]|2\.0)/', $bytes)
                && preg_match('/startxref\s+(\d+)\s+%%EOF\s*$/', $bytes, $xref)
                && (int) $xref[1] < strlen($bytes)
                && preg_match('/^(xref\b|\d+\s+\d+\s+obj\b)/', substr($bytes, (int) $xref[1]))
                && ! preg_match('/\/(Encrypt|JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/', $names);
            $this->require($valid);

            return;
        }
        if (in_array($extension, ['txt', 'csv'], true)) {
            $bytes = file_get_contents($path);
            $this->require(in_array($mime, ['text/plain', 'text/csv', 'application/csv', 'application/x-empty'], true)
                && mb_check_encoding($bytes, 'UTF-8') && ! preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $bytes));

            return;
        }
        $zip = new ZipArchive;
        $this->require($zip->open($path) === true);
        try {
            $this->require($zip->numFiles > 0 && $zip->numFiles <= config('chat_media.max_archive_entries'));
            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = $zip->statIndex($i);
                $name = $entry['name'];
                $total += $entry['size'];
                $this->require($total <= config('chat_media.max_archive_bytes')
                    && ($entry['encryption_method'] ?? 0) === 0
                    && ! preg_match('~(^/|(^|/)\.\.(/|$)|\\\\|vba|macros|scripts/|embeddings/|\.exe$|\.dll$|\.bin$)~i', $name));
                $zip->getExternalAttributesIndex($i, $system, $attributes);
                $this->require($system !== ZipArchive::OPSYS_UNIX || (($attributes >> 16) & 0170000) !== 0120000);
                // Read every entry under the expansion bound and verify its CRC.
                $contents = $zip->getFromIndex($i);
                $this->require($contents !== false && strlen($contents) === $entry['size']
                    && hash('crc32b', $contents) === sprintf('%08x', $entry['crc']));
                if (str_ends_with(strtolower($name), '.xml')) {
                    $this->require(! preg_match('/<!DOCTYPE|<!ENTITY|macroEnabled/i', $contents));
                    $previous = libxml_use_internal_errors(true);
                    try {
                        $this->require(simplexml_load_string($contents, \SimpleXMLElement::class, LIBXML_NONET) !== false);
                    } finally {
                        libxml_clear_errors();
                        libxml_use_internal_errors($previous);
                    }
                }
            }
            if (in_array($extension, ['docx', 'xlsx', 'pptx'], true)) {
                $part = ['docx' => 'word/document.xml', 'xlsx' => 'xl/workbook.xml', 'pptx' => 'ppt/presentation.xml'][$extension];
                $type = ['docx' => 'wordprocessingml.document.main+xml', 'xlsx' => 'spreadsheetml.sheet.main+xml', 'pptx' => 'presentationml.presentation.main+xml'][$extension];
                $types = $zip->getFromName('[Content_Types].xml');
                $this->require($zip->locateName($part) !== false && is_string($types) && str_contains($types, $type));
            } else {
                $type = ['odt' => 'text', 'ods' => 'spreadsheet', 'odp' => 'presentation'][$extension];
                $this->require($zip->getFromName('mimetype') === 'application/vnd.oasis.opendocument.'.$type
                    && $zip->locateName('content.xml') !== false);
            }
        } finally {
            $zip->close();
        }
    }

    private function require(bool $condition): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['file' => 'This document is unsupported, encrypted, unsafe or malformed.']);
        }
    }
}
