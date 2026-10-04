<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{{ $title }}</title>
<style>body { font-family: Helvetica, sans-serif; font-size: 12px; color: #222; } h1 { font-size: 20px; } table { width: 100%; border-collapse: collapse; } td { padding: 10px 0; border-bottom: 1px solid #ddd; } .amount { font-size: 18px; font-weight: bold; }</style></head>
<body><h1>Aisley — {{ $title }}</h1><p>Sandbox document · Simulated payment workflow</p><p>Reference: {{ $reference }}</p>
<p class="amount">{{ $currency }} {{ number_format($amount / 100, 2) }}</p><table>@foreach($rows as [$label, $value])<tr><td>{{ $label }}</td><td>{{ $value }}</td></tr>@endforeach</table>
<p>All dates and times are Asia/Manila.</p></body></html>
