<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { size: A6 portrait; margin: 5mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: Helvetica, sans-serif; font-size: 7.5pt; }
        .label { position: relative; width: 100%; height: 138mm; border: 1.2pt solid #111; page-break-after: always; overflow: hidden; }
        .label:last-child { page-break-after: auto; }
        .header { padding: 3mm; border-bottom: 2pt solid #111; }
        .brand { font-size: 15pt; font-weight: bold; letter-spacing: .2pt; }
        .service { float: right; margin-top: 1mm; font-size: 7pt; font-weight: bold; }
        .reference { padding: 2.5mm 3mm; border-bottom: 1pt solid #111; text-align: center; }
        .ref { font-size: 12pt; font-weight: bold; letter-spacing: .7pt; }
        .order { margin-top: .8mm; font-size: 7pt; }
        .section { padding: 2.2mm 3mm; border-bottom: 1pt solid #111; }
        .title { margin-bottom: 1mm; font-size: 6pt; font-weight: bold; letter-spacing: .6pt; text-transform: uppercase; }
        .recipient { font-size: 10pt; font-weight: bold; }
        .address { line-height: 1.32; word-wrap: break-word; }
        .route { width: 100%; border-collapse: collapse; }
        .route td { width: 50%; padding: 2.2mm 3mm; vertical-align: top; }
        .route td + td { border-left: 1pt solid #111; }
        .footer { position: absolute; right: 0; bottom: 0; left: 0; height: 43mm; border-top: 2pt solid #111; }
        .details { width: 55%; padding: 3mm; vertical-align: top; }
        .qr { width: 45%; padding: 2mm 2mm 1mm; border-left: 1pt solid #111; text-align: center; vertical-align: top; }
        .qr img { width: 31mm; height: 31mm; }
        .cod { display: inline-block; border: 2pt solid #111; padding: 1.2mm 2mm; font-weight: bold; font-size: 10pt; }
        .amount { margin-top: 2mm; font-size: 9pt; font-weight: bold; }
        .small { color: #333; font-size: 6pt; line-height: 1.25; }
    </style>
</head>
<body>
@foreach ($labels as $label)
    @php($s = $label['snapshot'])
    <section class="label">
        <div class="header"><span class="brand">AISLEY</span><span class="service">STANDARD DELIVERY</span></div>
        <div class="reference"><div class="ref">{{ $s['waybill_reference'] }}</div><div class="order">ORDER {{ $s['order_reference'] }} · CREATED {{ $s['created_at'] }}</div></div>
        <div class="section"><div class="title">Deliver to</div>
            <div class="recipient">{{ $s['recipient']['name'] }}</div>
            <div>{{ $s['recipient']['contact_number'] }}</div>
            <div class="address">{{ $s['recipient']['address_line_1'] }}@if($s['recipient']['address_line_2']), {{ $s['recipient']['address_line_2'] }}@endif<br>{{ $s['recipient']['barangay'] }}, {{ $s['recipient']['city_municipality'] }}, {{ $s['recipient']['province'] }}@if($s['recipient']['postal_code']) {{ $s['recipient']['postal_code'] }}@endif<br>{{ $s['recipient']['region'] }}, {{ $s['recipient']['country'] }}</div>
        </div>
        <table class="route"><tr><td><div class="title">Seller pickup</div><strong>{{ $s['shop']['name'] }}</strong><br>{{ $s['pickup']['contact_number'] }}<div class="address">{{ $s['pickup']['address_line_1'] }}@if($s['pickup']['address_line_2']), {{ $s['pickup']['address_line_2'] }}@endif<br>{{ $s['pickup']['barangay'] }}, {{ $s['pickup']['city_municipality'] }}, {{ $s['pickup']['province'] }}@if($s['pickup']['postal_code']) {{ $s['pickup']['postal_code'] }}@endif</div></td><td><div class="title">Sort through</div><strong>{{ $s['logistics']['business_name'] }}</strong><br>{{ $s['logistics']['hub_name'] }}<div class="address">{{ $s['logistics']['hub_area']['city_municipality'] }}, {{ $s['logistics']['hub_area']['province'] }}</div></td></tr></table>
        <table class="footer"><tr><td class="details"><span class="cod">COD</span><div class="amount">{{ $s['payment']['currency'] }} {{ number_format((float) $s['payment']['collectible_amount'], 2) }}</div><div style="margin-top: 3mm">Parcel item quantity<br><strong style="font-size: 10pt">{{ $s['item_quantity'] }}</strong></div><div class="small" style="margin-top: 3mm">Keep this label flat, dry, and fully visible.</div></td><td class="qr"><img src="{{ $label['qr'] }}" alt=""><div class="small">Scan in the authorized Aisley app<br>{{ $s['waybill_reference'] }}</div></td></tr></table>
    </section>
@endforeach
</body>
</html>
