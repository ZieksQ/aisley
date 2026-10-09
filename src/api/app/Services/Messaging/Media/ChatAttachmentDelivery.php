<?php

namespace App\Services\Messaging\Media;

use App\Enums\ChatAttachmentState;
use App\Models\ChatAttachment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatAttachmentDelivery
{
    public function response(User $actor, string $id, Request $request, bool $preview): StreamedResponse
    {
        $asset = ChatAttachment::query()->findOrFail($id);
        abort_unless($asset->message_id && $asset->conversation_id && $asset->state === ChatAttachmentState::Ready, 404);
        app(ChatAttachmentScope::class)->find($actor, $asset->conversation_id);
        $path = $preview ? $asset->preview_path : $asset->path;
        abort_unless($path && Storage::disk($asset->disk)->exists($path), 404);
        $size = Storage::disk($asset->disk)->size($path);
        $start = 0;
        $end = $size - 1;
        $status = 200;
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff',
            'Content-Type' => $preview ? 'image/jpeg' : $asset->mime_type,
            'Content-Disposition' => HeaderUtils::makeDisposition(
                ! $preview && $asset->kind === 'document' ? 'attachment' : 'inline',
                $preview ? 'preview.jpg' : $asset->filename,
                $preview ? 'preview.jpg' : 'attachment.'.pathinfo($asset->filename, PATHINFO_EXTENSION)),
        ];
        if (! $preview && $asset->kind === 'video') {
            $headers['Accept-Ranges'] = 'bytes';
            if ($range = $request->header('Range')) {
                if (! preg_match('/^bytes=(\d*)-(\d*)$/', $range, $matches) || ($matches[1] === '' && $matches[2] === '')) {
                    abort(416, 'Unsupported range.', ['Content-Range' => "bytes */{$size}"]);
                }
                if ($matches[1] === '') {
                    $start = max(0, $size - (int) $matches[2]);
                } else {
                    $start = (int) $matches[1];
                    $end = $matches[2] === '' ? $end : min($end, (int) $matches[2]);
                }
                abort_if($start > $end || $start >= $size, 416, 'Range unavailable.', ['Content-Range' => "bytes */{$size}"]);
                $status = 206;
                $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
            }
        }
        $headers['Content-Length'] = (string) ($end - $start + 1);
        $stream = Storage::disk($asset->disk)->readStream($path);
        abort_unless(is_resource($stream), 503, 'Attachment is temporarily unavailable.');

        return response()->stream(function () use ($stream, $start, $end): void {
            try {
                $skip = $start;
                while ($skip > 0 && ! feof($stream)) {
                    $chunk = fread($stream, min(65536, $skip));
                    if ($chunk === false || $chunk === '') {
                        return;
                    }
                    $skip -= strlen($chunk);
                }
                $remaining = $end - $start + 1;
                while ($remaining > 0 && ! feof($stream) && ! connection_aborted()) {
                    $chunk = fread($stream, min(65536, $remaining));
                    if ($chunk === false || $chunk === '') {
                        break;
                    }
                    echo $chunk;
                    $remaining -= strlen($chunk);
                }
            } finally {
                fclose($stream);
            }
        }, $status, $headers);
    }
}
