<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { size: A6 portrait; margin: 4mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { color: #111; font-family: Helvetica, sans-serif; font-size: 7pt; }
        .label { width: 100%; height: 132mm; border-collapse: collapse; border-spacing: 0; table-layout: fixed; page-break-after: always; page-break-inside: avoid; }
        .label-last { page-break-after: auto; }
        .label > tbody > tr > td { border: 1pt solid #111; vertical-align: top; }
        .header-cell { padding: 2.2mm 3mm; vertical-align: middle !important; }
        .header-grid { width: 100%; border-collapse: collapse; border-spacing: 0; table-layout: fixed; }
        .header-grid td { padding: 0; border: 0; vertical-align: middle; }
        .brand { font-size: 14pt; font-weight: bold; letter-spacing: .2pt; }
        .service { text-align: right; font-size: 7pt; font-weight: bold; }
        .reference-cell { padding: 2.5mm 3mm; text-align: center; vertical-align: middle !important; }
        .ref { font-size: 11pt; font-weight: bold; letter-spacing: .5pt; }
        .order { margin-top: 1mm; font-size: 6.5pt; }
        .delivery-cell { padding: 2.2mm 3mm; }
        .route-cell { padding: 2.2mm 3mm; }
        .footer-cell { padding: 2.5mm 3mm; }
        .title { margin-bottom: 1mm; font-size: 5.8pt; font-weight: bold; letter-spacing: .5pt; text-transform: uppercase; }
        .recipient { font-size: 9.5pt; font-weight: bold; }
        .address { line-height: 1.28; overflow-wrap: break-word; word-wrap: break-word; }
        .qr { padding: 1.8mm 2mm 1mm; text-align: center; vertical-align: middle !important; }
        .qr img { display: block; width: 29mm; height: 29mm; margin: 0 auto 1mm; }
        .cod { display: inline-block; border: 1.5pt solid #111; padding: 1mm 2mm; font-weight: bold; font-size: 9.5pt; }
        .amount { margin-top: 1.5mm; font-size: 8.5pt; font-weight: bold; }
        .quantity { margin-top: 2.5mm; }
        .quantity strong { font-size: 9.5pt; }
        .handling { margin-top: 2.5mm; }
        .small { color: #333; font-size: 5.8pt; line-height: 1.2; }
    </style>
</head>
<body>
@foreach ($labels as $label)
    @php($s = $label['snapshot'])
    <table class="label{{ $loop->last ? ' label-last' : '' }}">
        <colgroup><col style="width: 50%"><col style="width: 50%"></colgroup>
        <tbody>
            <tr><td class="header-cell" colspan="2"><table class="header-grid"><tr><td><span class="brand">AISLEY</span></td><td class="service">STANDARD DELIVERY</td></tr></table></td></tr>
            <tr><td class="reference-cell" colspan="2"><div class="ref">{{ $s['waybill_reference'] }}</div><div class="order">ORDER {{ $s['order_reference'] }} · CREATED {{ $s['created_at'] }}</div></td></tr>
            <tr><td class="delivery-cell" colspan="2"><div class="title">Deliver to</div><div class="recipient">{{ $s['recipient']['name'] }}</div><div>{{ $s['recipient']['contact_number'] }}</div><div class="address">{{ $s['recipient']['address_line_1'] }}@if($s['recipient']['address_line_2']), {{ $s['recipient']['address_line_2'] }}@endif<br>{{ $s['recipient']['barangay'] }}, {{ $s['recipient']['city_municipality'] }}, {{ $s['recipient']['province'] }}@if($s['recipient']['postal_code']) {{ $s['recipient']['postal_code'] }}@endif<br>{{ $s['recipient']['region'] }}, {{ $s['recipient']['country'] }}</div></td></tr>
            <tr><td class="route-cell"><div class="title">Seller pickup</div><strong>{{ $s['shop']['name'] }}</strong><br>{{ $s['pickup']['contact_number'] }}<div class="address">{{ $s['pickup']['address_line_1'] }}@if($s['pickup']['address_line_2']), {{ $s['pickup']['address_line_2'] }}@endif<br>{{ $s['pickup']['barangay'] }}, {{ $s['pickup']['city_municipality'] }}, {{ $s['pickup']['province'] }}@if($s['pickup']['postal_code']) {{ $s['pickup']['postal_code'] }}@endif</div></td><td class="route-cell"><div class="title">Sort through</div><strong>{{ $s['logistics']['business_name'] }}</strong><br>{{ $s['logistics']['hub_name'] }}<div class="address">{{ $s['logistics']['hub_area']['city_municipality'] }}, {{ $s['logistics']['hub_area']['province'] }}</div></td></tr>
            <tr><td class="footer-cell"><span class="cod">COD</span><div class="amount">{{ $s['payment']['currency'] }} {{ number_format((float) $s['payment']['collectible_amount'], 2) }}</div><div class="quantity">Parcel item quantity<br><strong>{{ $s['item_quantity'] }}</strong></div><div class="small handling">Keep this label flat, dry, and fully visible.</div></td><td class="footer-cell qr"><img src="{{ $label['qr'] }}" alt=""><div class="small">Scan in the authorized Aisley app<br>{{ $s['waybill_reference'] }}</div></td></tr>
        </tbody>
    </table>
@endforeach
</body>
</html>
