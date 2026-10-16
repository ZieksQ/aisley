<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Order picking sheet</title>
    <style>
        @page { margin: 14mm 12mm; }
        body { margin: 0; color: #111; font-family: "DejaVu Sans", sans-serif; font-size: 9pt; line-height: 1.2; word-spacing: 0; letter-spacing: 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th, td { padding: 1.5mm 2mm; border: 0.3mm solid #999; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-wrap: break-word; }
        th { font-size: 9pt; }
        .details { width: 30%; }
        .reference, .product, .quantity { font-weight: bold; }
        .customer { margin-top: 0.5mm; font-size: 8pt; }
        .quantity { white-space: nowrap; }
        .check { display: inline-block; width: 3mm; height: 3mm; margin-right: 1mm; border: 0.3mm solid #111; vertical-align: middle; }
    </style>
</head>
<body>
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
                            <div class="customer">{{ $order['customer'] }}</div>
                        </td>
                        <td>
                            <span class="quantity"><span class="check"></span>Qty: {{ $item['quantity'] }}</span>
                            <span class="product">{{ $item['name'] }}</span>
                            @if ($item['variant']) · <span>{{ $item['variant'] }}</span>@endif
                            @if ($item['options']) · <span>{{ $item['options'] }}</span>@endif
                            · <span>SKU: {{ $item['sku'] }}</span>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td><div class="reference">{{ $order['reference'] }}</div><div class="customer">{{ $order['customer'] }}</div></td>
                        <td>Purchased item snapshot unavailable. Check this order before picking.</td>
                    </tr>
                @endforelse
            @endforeach
        </tbody>
    </table>
</body>
</html>
