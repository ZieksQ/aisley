<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignSupportTicketRequest;
use App\Http\Requests\Admin\ChangeSupportTicketStatusRequest;
use App\Http\Requests\Admin\ClaimSupportTicketRequest;
use App\Http\Requests\Support\ListSupportTicketsRequest;
use App\Http\Requests\Support\ReplySupportTicketRequest;
use App\Models\User;
use App\Services\Support\SupportTicketReader;
use App\Services\Support\SupportTicketWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function __construct(
        private readonly SupportTicketReader $reader,
        private readonly SupportTicketWriter $writer,
    ) {}

    public function index(ListSupportTicketsRequest $request): JsonResponse
    {
        return $this->respond($this->reader->index($request->user(), $request->validated()));
    }

    public function assignees(): JsonResponse
    {
        $items = User::query()
            ->where('role', UserRole::Admin->value)
            ->where('status', UserStatus::Active->value)
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'support-tickets.view'))
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'support-tickets.manage'))
            ->with('adminProfile:user_id,first_name,last_name')
            ->get(['id'])
            ->map(fn (User $admin) => [
                'id' => $admin->id,
                'name' => trim(($admin->adminProfile?->first_name ?? '').' '.($admin->adminProfile?->last_name ?? '')) ?: 'Administrator',
            ])
            ->all();

        return $this->respond(['items' => $items]);
    }

    public function show(Request $request, string $ticket): JsonResponse
    {
        $input = $request->validate(['cursor' => ['sometimes', 'string', 'max:2048'], 'limit' => ['sometimes', 'integer', 'min:1', 'max:50']]);

        return $this->respond($this->reader->detail($request->user(), $ticket, (int) ($input['limit'] ?? 30)));
    }

    public function claim(ClaimSupportTicketRequest $request, string $ticket): JsonResponse
    {
        return $this->written($this->writer->claim($request->user(), $ticket, (int) $request->validated('expected_revision'), $request->idempotencyKey()));
    }

    public function assign(AssignSupportTicketRequest $request, string $ticket): JsonResponse
    {
        return $this->written($this->writer->assign($request->user(), $ticket, $request->validated(), $request->idempotencyKey()));
    }

    public function reply(ReplySupportTicketRequest $request, string $ticket): JsonResponse
    {
        return $this->written($this->writer->reply($request->user(), $ticket, $request->validated(), $request->idempotencyKey()));
    }

    public function status(ChangeSupportTicketStatusRequest $request, string $ticket): JsonResponse
    {
        return $this->written($this->writer->status($request->user(), $ticket, $request->validated(), $request->idempotencyKey()));
    }

    public function read(Request $request, string $ticket): JsonResponse
    {
        $input = $request->validate(['last_read_sequence' => ['required', 'integer', 'min:0']]);

        return $this->respond($this->reader->markRead($request->user(), $ticket, (int) $input['last_read_sequence']));
    }

    private function written(array $result): JsonResponse
    {
        return $this->respond($result['payload'], $result['status']);
    }

    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'private, no-store');
    }
}
