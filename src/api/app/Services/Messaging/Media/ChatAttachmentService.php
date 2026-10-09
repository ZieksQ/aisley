<?php

namespace App\Services\Messaging\Media;

use App\Enums\ChatAttachmentState;
use App\Jobs\ProcessChatAttachment;
use App\Models\ChatAttachment;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ChatAttachmentService
{
    public function __construct(private readonly ChatAttachmentScope $scope) {}

    public function enabled(): bool
    {
        if (! config('chat_media.enabled') || ! in_array(config('chat_media.disk'), ['local', 'azure'], true)) {
            return false;
        }

        return Cache::remember('chat-media-runtime-ready', 10, fn () => app(ChatMediaInspector::class)->available() && app(ChatMediaScanner::class)->available());
    }

    public function upload(User $actor, UploadedFile $file, array $context, string $key): ChatAttachment
    {
        abort_unless($this->enabled(), 503, 'Attachments are temporarily unavailable. Text messages remain available.');
        $conversation = $this->scope->resolve($actor, $context);
        $scope = $this->scope->hash($conversation);
        $name = $file->getClientOriginalName();
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (! isset(ChatMediaInspector::MIME[$extension]) || substr_count($name, '.') !== 1
            || preg_match('/[\x00-\x1F\x7F\\\\\/]/', $name) || mb_strlen($name) > 180) {
            throw ValidationException::withMessages(['file' => 'Choose a supported file with a single, matching extension.']);
        }
        $size = $file->getSize();
        $mime = ChatMediaInspector::MIME[$extension];
        $kind = str_starts_with($mime, 'image/') ? 'image' : ($extension === 'mp4' ? 'video' : 'document');
        if ($size <= 0 || $size > ($kind === 'video' ? 30 : 10) * 1024 * 1024
            || ($kind === 'image' && $size >= 10 * 1024 * 1024)) {
            throw ValidationException::withMessages(['file' => 'This file exceeds the allowed size or is empty.']);
        }
        $checksum = hash_file('sha256', $file->getRealPath());
        $stored = null;
        try {
            return DB::transaction(function () use ($actor, $file, $scope, $conversation, $key, $name, $extension, $size, $mime, $kind, $checksum, &$stored): ChatAttachment {
                User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
                $existing = ChatAttachment::query()->where('uploader_id', $actor->id)->where('upload_key', $key)->first();
                if ($existing) {
                    abort_unless($existing->scope_hash === $scope && $existing->checksum === $checksum
                        && $existing->filename === $name, 409, 'This upload key was used for another file or conversation.');

                    return $existing;
                }
                abort_if(ChatAttachment::query()->where('uploader_id', $actor->id)->whereNull('message_id')
                    ->where('state', '!=', ChatAttachmentState::Deleted->value)->count() >= 50, 429, 'Remove unused attachments before uploading more.');
                $id = (string) Str::uuid();
                $disk = (string) config('chat_media.disk');
                $path = "chat-media/{$actor->id}/{$id}.{$extension}";
                $stream = fopen($file->getRealPath(), 'rb');
                try {
                    if (! Storage::disk($disk)->put($path, $stream, ['visibility' => 'private'])) {
                        throw new RuntimeException('Unable to store attachment.');
                    }
                    $stored = [$disk, $path];
                } finally {
                    fclose($stream);
                }
                $asset = ChatAttachment::create([
                    'id' => $id, 'uploader_id' => $actor->id, 'upload_key' => $key, 'scope_hash' => $scope,
                    'conversation_id' => $conversation->exists ? $conversation->id : null,
                    'disk' => $disk, 'path' => $path, 'filename' => $name, 'kind' => $kind,
                    'mime_type' => $mime, 'byte_size' => $size, 'checksum' => $checksum,
                    'state' => ChatAttachmentState::Pending, 'expires_at' => now()->addDay(),
                ]);
                ProcessChatAttachment::dispatch($asset->id)->onConnection('media')->onQueue(config('chat_media.queue'))->afterCommit();

                return $asset;
            });
        } catch (\Throwable $error) {
            if ($stored && ! ChatAttachment::query()->where('path', $stored[1])->exists()) {
                Storage::disk($stored[0])->delete($stored[1]);
            }
            throw $error;
        }
    }

    public function bind(Message $message, Conversation $conversation, User $actor, array $ids): void
    {
        if (! $ids) {
            return;
        }
        $rows = ChatAttachment::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        $scope = $this->scope->hash($conversation);
        $total = 0;
        if (! array_is_list($ids) || count($ids) > 5 || count(array_unique($ids)) !== count($ids) || count($rows) !== count($ids)) {
            throw ValidationException::withMessages(['attachment_ids' => 'Select up to five available attachments.']);
        }
        foreach ($ids as $position => $id) {
            $asset = $rows[$id];
            $total += $asset->byte_size;
            if ($asset->uploader_id !== $actor->id || $asset->scope_hash !== $scope || $asset->message_id
                || $asset->state !== ChatAttachmentState::Ready || $asset->expires_at->isPast()
                || ! Storage::disk($asset->disk)->exists($asset->path)) {
                throw ValidationException::withMessages(['attachment_ids' => 'Every attachment must be ready and belong to this message context.']);
            }
            $asset->update(['message_id' => $message->id, 'conversation_id' => $conversation->id, 'position' => $position]);
        }
        if ($total > 50 * 1024 * 1024) {
            throw ValidationException::withMessages(['attachment_ids' => 'Attachments may total at most 50 MiB.']);
        }
    }

    public function owned(User $actor, string $id): ChatAttachment
    {
        return ChatAttachment::query()->where('uploader_id', $actor->id)->findOrFail($id);
    }

    public function remove(User $actor, string $id): void
    {
        DB::transaction(function () use ($actor, $id): void {
            $asset = ChatAttachment::query()->where('uploader_id', $actor->id)->whereKey($id)->lockForUpdate()->firstOrFail();
            abort_if($asset->message_id, 409, 'This attachment has already been sent.');
            $this->deleteBytes($asset);
        });
    }

    public function retry(User $actor, string $id): ChatAttachment
    {
        abort_unless($this->enabled(), 503, 'Attachments are temporarily unavailable.');

        return DB::transaction(function () use ($actor, $id): ChatAttachment {
            $asset = ChatAttachment::query()->where('uploader_id', $actor->id)->whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(! $asset->message_id && $asset->state === ChatAttachmentState::Failed && $asset->expires_at->isFuture(), 409);
            $asset->update(['state' => ChatAttachmentState::Pending, 'error_code' => null, 'attempts' => 0]);
            ProcessChatAttachment::dispatch($id)->onConnection('media')->onQueue(config('chat_media.queue'))->afterCommit();

            return $asset;
        });
    }

    public function deleteBytes(ChatAttachment $asset): void
    {
        foreach (array_filter([$asset->path, $asset->preview_path ?? $asset->path.'.preview.jpg']) as $path) {
            if (! Storage::disk($asset->disk)->delete($path)) {
                throw new RuntimeException('Unable to remove attachment.');
            }
        }
        $asset->update(['state' => ChatAttachmentState::Deleted, 'error_code' => null]);
    }

    public function dto(ChatAttachment $asset, string $role): array
    {
        $base = "/api/v1/{$role}/chat-attachments/{$asset->id}";

        return [
            'id' => $asset->id, 'kind' => $asset->kind, 'filename' => $asset->filename,
            'mime_type' => $asset->mime_type, 'byte_size' => $asset->byte_size,
            'state' => $asset->state->value, 'error_code' => $asset->error_code,
            'width' => $asset->width, 'height' => $asset->height, 'duration_seconds' => $asset->duration_seconds,
            'content_url' => $asset->message_id && $asset->state === ChatAttachmentState::Ready ? $base.'/content' : null,
            'preview_url' => $asset->message_id && $asset->preview_path && $asset->state === ChatAttachmentState::Ready ? $base.'/preview' : null,
        ];
    }

    public function messages(Message $message, User $viewer): array
    {
        return $message->attachments->map(fn ($asset) => $this->dto($asset, $viewer->role->value))->all();
    }

    public static function hash(array $parts, array $ids): string
    {
        if ($ids) {
            $parts[] = array_values($ids);
        }

        return hash('sha256', json_encode($parts, JSON_THROW_ON_ERROR));
    }

    public static function body(string $body, array $ids): string
    {
        return trim($body) !== '' ? $body : (count($ids) === 1 ? 'Sent an attachment' : 'Sent '.count($ids).' attachments');
    }
}
