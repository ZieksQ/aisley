<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\UploadChatAttachmentRequest;
use App\Services\Messaging\Media\ChatAttachmentDelivery;
use App\Services\Messaging\Media\ChatAttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatAttachmentController extends Controller
{
    public function __construct(private readonly ChatAttachmentService $media) {}

    public function capabilities(): JsonResponse
    {
        return $this->json(['data' => ['enabled' => $this->media->enabled(), 'max_files' => 5, 'max_total_bytes' => 50 * 1024 * 1024]]);
    }

    public function upload(UploadChatAttachmentRequest $request): JsonResponse
    {
        $context = json_decode($request->validated('context'), true);
        Validator::make(['context' => $context], ['context' => ['required', 'array']])->validate();
        $asset = $this->media->upload($request->user(), $request->file('file'), $context, $request->header('Idempotency-Key'));

        return $this->json(['data' => $this->media->dto($asset, $request->user()->role->value)], $asset->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Request $request, string $attachment): JsonResponse
    {
        return $this->json(['data' => $this->media->dto($this->media->owned($request->user(), $attachment), $request->user()->role->value)]);
    }

    public function retry(Request $request, string $attachment): JsonResponse
    {
        return $this->json(['data' => $this->media->dto($this->media->retry($request->user(), $attachment), $request->user()->role->value)]);
    }

    public function destroy(Request $request, string $attachment): JsonResponse
    {
        $this->media->remove($request->user(), $attachment);

        return $this->json(['deleted' => true]);
    }

    public function content(Request $request, string $attachment, ChatAttachmentDelivery $delivery): StreamedResponse
    {
        return $delivery->response($request->user(), $attachment, $request, false);
    }

    public function preview(Request $request, string $attachment, ChatAttachmentDelivery $delivery): StreamedResponse
    {
        return $delivery->response($request->user(), $attachment, $request, true);
    }

    private function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }
}
