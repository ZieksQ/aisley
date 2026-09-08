<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { size: A6 portrait; margin: 7mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: Helvetica, Arial, sans-serif; font-size: 8pt; }
        .label { position: relative; width: 100%; height: 134mm; page-break-after: always; }
        .label:last-child { page-break-after: auto; }
        h1 { margin: 0 0 1mm; font-size: 14pt; letter-spacing: .4pt; }
        .ref { font-size: 10pt; font-weight: bold; }
        .section { border-top: 1px solid #111; margin-top: 2mm; padding-top: 1.5mm; }
        .title { font-size: 6.5pt; font-weight: bold; letter-spacing: .5pt; text-transform: uppercase; }
        .address { line-height: 1.25; }
        .qr { position: absolute; right: 0; bottom: 0; width: 35mm; text-align: center; }
        .qr img { width: 32mm; height: 32mm; }
        .cod { display: inline-block; border: 2px solid #111; padding: 1mm 2mm; font-weight: bold; font-size: 11pt; }
        .small { color: #333; font-size: 6.5pt; }
    </style>
</head>
<body>
@foreach ($labels as $label)
    @php($s = $label['snapshot'])
    <section class="label">
        <h1>AISLEY WAYBILL</h1>
        <div class="ref">{{ $s['waybill_reference'] }}</div>
        <div>Order: {{ $s['order_reference'] }}</div>
        <div class="small">Created {{ $s['created_at'] }} · Template v{{ $label['waybill']->template_version }}</div>

        <div class="section"><div class="title">From / Seller pickup</div>
            <strong>{{ $s['shop']['name'] }}</strong> · {{ $s['pickup']['contact_number'] }}<br>
            <span class="address">{{ $s['pickup']['address_line_1'] }}@if($s['pickup']['address_line_2']), {{ $s['pickup']['address_line_2'] }}@endif, {{ $s['pickup']['barangay'] }}, {{ $s['pickup']['city_municipality'] }}, {{ $s['pickup']['province'] }} {{ $s['pickup']['postal_code'] }}</span>
        </div>
        <div class="section"><div class="title">To / Recipient</div>
            <strong>{{ $s['recipient']['name'] }}</strong> · {{ $s['recipient']['contact_number'] }}<br>
            <span class="address">{{ $s['recipient']['address_line_1'] }}@if($s['recipient']['address_line_2']), {{ $s['recipient']['address_line_2'] }}@endif, {{ $s['recipient']['barangay'] }}, {{ $s['recipient']['city_municipality'] }}, {{ $s['recipient']['province'] }} {{ $s['recipient']['postal_code'] }}</span>
        </div>
        <div class="section"><div class="title">Logistics</div>
            <strong>{{ $s['logistics']['business_name'] }}</strong><br>{{ $s['logistics']['hub_name'] }} · {{ $s['logistics']['hub_area']['city_municipality'] }}, {{ $s['logistics']['hub_area']['province'] }}
        </div>
        <div class="section">
            <span class="cod">COD {{ $s['payment']['currency'] }} {{ number_format((float) $s['payment']['collectible_amount'], 2) }}</span>
            <div style="margin-top: 2mm">Item quantity: <strong>{{ $s['item_quantity'] }}</strong></div>
        </div>
        <div class="qr"><img src="{{ $label['qr'] }}" alt=""><div class="small">Scan only in the authorized Aisley app</div></div>
    </section>
@endforeach
</body>
</html>
