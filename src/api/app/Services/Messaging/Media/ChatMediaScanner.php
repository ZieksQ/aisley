<?php

namespace App\Services\Messaging\Media;

use RuntimeException;

class ChatMediaScanner
{
    private function connection()
    {
        $host = (string) config('chat_media.clamav_host');
        $port = (int) config('chat_media.clamav_port');
        $socket = @stream_socket_client("tcp://{$host}:{$port}", $code, $message, 5);
        if ($socket === false) {
            throw new RuntimeException('Scanner unavailable.');
        }
        stream_set_timeout($socket, 30);

        return $socket;
    }

    public function available(): bool
    {
        try {
            $socket = $this->connection();
            try {
                $this->write($socket, "zPING\0");

                return $this->response($socket) === 'PONG';
            } finally {
                fclose($socket);
            }
        } catch (RuntimeException) {
            return false;
        }
    }

    public function scan(string $path): bool
    {
        $socket = $this->connection();
        $file = fopen($path, 'rb');
        if ($file === false) {
            fclose($socket);
            throw new RuntimeException('Unable to read media.');
        }
        try {
            $this->write($socket, "zINSTREAM\0");
            while (! feof($file)) {
                $bytes = fread($file, 65536);
                if ($bytes === false) {
                    throw new RuntimeException('Unable to read media.');
                }
                if ($bytes !== '') {
                    $this->write($socket, pack('N', strlen($bytes)).$bytes);
                }
            }
            $this->write($socket, pack('N', 0));
            $result = $this->response($socket);
            if (preg_match('/^stream: .+ FOUND$/', $result)) {
                return false;
            }
            if ($result !== 'stream: OK') {
                throw new RuntimeException('Scanner did not complete.');
            }

            return true;
        } finally {
            fclose($file);
            fclose($socket);
        }
    }

    private function response($socket): string
    {
        $result = '';
        while (strlen($result) < 1024) {
            $byte = fread($socket, 1);
            if ($byte === false || $byte === '') {
                throw new RuntimeException('Scanner response incomplete.');
            }
            if ($byte === "\0") {
                return $result;
            }
            $result .= $byte;
        }
        throw new RuntimeException('Scanner response too long.');
    }

    private function write($socket, string $bytes): void
    {
        while ($bytes !== '') {
            $written = fwrite($socket, $bytes);
            if (! $written) {
                throw new RuntimeException('Scanner did not accept content.');
            }
            $bytes = substr($bytes, $written);
        }
    }
}
