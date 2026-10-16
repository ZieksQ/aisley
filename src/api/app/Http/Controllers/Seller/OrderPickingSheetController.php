<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\PrintOrderPickingSheetRequest;
use App\Services\Seller\OrderPickingSheetService;
use Symfony\Component\HttpFoundation\Response;

class OrderPickingSheetController extends Controller
{
    public function __invoke(PrintOrderPickingSheetRequest $request, OrderPickingSheetService $sheets): Response
    {
        return $sheets->response($request->user(), $request->validated('order_ids'));
    }
}
