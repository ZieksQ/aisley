<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Order picking sheet</title>
    <style>
        @page { margin: 14mm 12mm; }
        body { color: #111; font-family: "DejaVu Sans", sans-serif; font-size: 9pt; line-height: 1.45; }
        h1 { margin: 0 0 2mm; font-size: 18pt; }
        p { margin: 0 0 2mm; }
        .summary { margin: 4mm 0 5mm; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th, td { padding: 3mm; border: 0.3mm solid #999; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-wrap: break-word; }
        th { background: #eee; font-size: 9pt; }
        .details { width: 39%; }
        .reference { font-weight: bold; }
        .meta { margin-top: 1.5mm; font-size: 8pt; }
        .muted { color: #444; }
        .product { margin-bottom: 2mm; font-weight: bold; }
        .quantity { margin-top: 2mm; font-size: 11pt; font-weight: bold; }
        .check { display: inline-block; width: 3mm; height: 3mm; margin-right: 2mm; border: 0.3mm solid #111; }
        .note { margin-top: 4mm; font-size: 8pt; color: #444; }
    </style>
</head>
<body>
    <h1>Order picking sheet</h1>
    <p>{{ $shopName }}</p>
    <p class="meta muted">Generated {{ $generatedAt }}</p>
    <p class="summary">{{ $orders->count() }} {{ $orders->count() === 1 ? 'order' : 'orders' }} · {{ $quantity }} {{ $quantity === 1 ? 'unit' : 'units' }}</p>
    <table>
        <thead>
            <tr><th class="details">Order / customer</th><th>Products to pick</th></tr>
        </thead>
        <tbody>
            @foreach ($orders as $order)
                @forelse ($order['items'] as $item)
                    <tr>
                        <td>
                            <div class="reference">{{ $order['reference'] }}</div>
                            <div class="meta">Customer / recipient: {{ $order['customer'] }}</div>
                            @if ($loop->first)
                                <div class="meta">Placed: {{ $order['placed_at'] }} (PHT)</div>
                                <div class="meta">Status: {{ $order['status'] }}</div>
                                @if ($order['destination'])
                                    <div class="meta">Destination: {{ $order['destination'] }}</div>
                                @endif
                            @else
                                <div class="meta muted">Continued</div>
                            @endif
                        </td>
                        <td>
                            <div class="product">{{ $item['name'] }}</div>
                            @if ($item['variant'])<div>{{ $item['variant'] }}</div>@endif
                            @if ($item['options'])<div class="meta">{{ $item['options'] }}</div>@endif
                            <div class="meta">SKU: {{ $item['sku'] }}</div>
                            <div class="quantity"><span class="check"></span>Quantity: {{ $item['quantity'] }}</div>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td><div class="reference">{{ $order['reference'] }}</div><div class="meta">Customer / recipient: {{ $order['customer'] }}</div></td>
                        <td>Purchased item snapshot unavailable. Check this order before picking.</td>
                    </tr>
                @endforelse
            @endforeach
        </tbody>
    </table>
    <p class="note">Verify the current order status before packing. Mark each product after picking.</p>
</body>
</html>
