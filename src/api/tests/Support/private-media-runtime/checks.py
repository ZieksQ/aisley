"""Real HTTP/storage/worker/scanner checks. Never include response bodies in failures."""

import base64
import json
import socket
import time
import uuid


def require(condition, label):
    if not condition:
        raise AssertionError(label)


def verify_custody(r):
    """Real scoped reads after a fixture-only transfer of current custody."""
    base = '/api/v1/logistics/operational-conversations/' + r.manifest['customer_logistics']
    status, _, body = r.request('GET', base + '/messages', 'logistics')
    require(status == 200, 'Original Logistics history unavailable')
    asset = next(a for m in json.loads(body)['data'] for a in m['attachments'])
    try:
        r.control('custody')
        r.manifest = json.loads((r.fixture / 'fixture.json').read_text())
        status, _, body = r.request('GET', base, 'logistics')
        require(status == 200 and not json.loads(body)['data']['send_allowed'], 'Custody transfer did not make original Logistics read-only')
        status, _, _ = r.request('GET', asset['content_url'], 'logistics')
        require(status == 200, 'Original participant lost authorized historical media')
        for path in (base, base + '/messages', asset['content_url']):
            status, _, _ = r.request('GET', path, 'replacement_logistics')
            require(status == 404, 'Replacement organization inherited private history or media')
    finally:
        r.control('restore')
    return 'ended custody preserves original history and denies replacement-organization media/history'


def verify(r):
    checks = []

    def mark(label):
        checks.append(label)
        print('PASS: ' + label, flush=True)

    def call(method, path, role, body=None, expected=(200,), headers=None):
        status, response_headers, content = r.request(method, '/api/v1/' + path, role, body, headers)
        require(status in expected, f'{method} {path}: expected {expected}, received {status}')
        if 'application/json' in response_headers.get('Content-Type', ''):
            return json.loads(content)
        return content, response_headers

    def upload(role, conversation, filename, content, key=None, expected=(201,)):
        boundary = 'g26-' + uuid.uuid4().hex
        context = json.dumps({'conversation_id': conversation}).encode()
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="context"\r\n\r\n'.encode()
                + context + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n'.encode() + content
                + f'\r\n--{boundary}--\r\n'.encode())
        return call('POST', f'{role}/chat-attachments', role, body, expected,
                    {'Content-Type': f'multipart/form-data; boundary={boundary}',
                     'Idempotency-Key': key or str(uuid.uuid4())})

    def wait(role, asset, state='ready', timeout=110):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            data = call('GET', f'{role}/chat-attachments/{asset}', role)['data']
            if data['state'] == state:
                return data
            require(data['state'] == 'pending', f'Expected {state}, received {data["state"]}')
            time.sleep(2)
        raise AssertionError(f'Worker did not reach {state}')

    def route(role, channel):
        return f'{role}/' + ('operational-conversations' if role == 'courier' else channel)

    def send(role, base, conversation, ids, key=None, expected=(200, 201), body=None):
        return call('POST', f'{base}/{conversation}/messages', role,
                    body or {'attachment_ids': ids}, expected,
                    {'Idempotency-Key': key or str(uuid.uuid4())})

    with socket.create_connection(('127.0.0.1', 13310), timeout=5) as scanner:
        scanner.sendall(b'zVERSION\0')
        version = scanner.recv(1024).decode().rstrip('\0')
        require(version.startswith('ClamAV '), 'Real ClamAV signature version unavailable')
    for role in ('customer', 'seller', 'logistics', 'courier'):
        require(call('GET', f'{role}/chat-attachments', role)['data']['enabled'], 'Capabilities disabled')
    call('GET', 'customer/chat-attachments', None, expected=(401,))
    call('GET', 'customer/chat-attachments', 'admin', expected=(403,))
    mark('real scanner/signatures and role-gated capabilities')

    files = {name: (r.fixture / name).read_bytes() for name in ('photo.png', 'clip.mp4', 'details.pdf')}
    pairs = [
        ('shop_thread', 'customer', 'conversations', 'seller', 'conversations'),
        ('customer_logistics', 'customer', 'logistics-conversations', 'logistics', 'operational-conversations'),
        ('seller_logistics', 'seller', 'logistics-conversations', 'logistics', 'operational-conversations'),
        ('operational', 'logistics', 'operational-conversations', 'courier', 'operational-conversations'),
        ('first_operational', 'logistics', 'operational-conversations', 'courier', 'operational-conversations'),
        ('customer_courier', 'customer', 'courier-conversations', 'courier', 'operational-conversations'),
        ('seller_courier', 'seller', 'courier-conversations', 'courier', 'operational-conversations'),
    ]
    received = {}
    first_asset = None
    for name, left, left_channel, right, right_channel in pairs:
        conversation = r.manifest[name]
        key = str(uuid.uuid4())
        image = upload(left, conversation, 'photo.png', files['photo.png'], key)['data']['id']
        if first_asset is None:
            first_asset = image
            call('GET', f'{left}/chat-attachments/{image}/content', left, expected=(404,))
            send(left, route(left, left_channel), conversation, [image], expected=(422,))
            replay = upload(left, conversation, 'photo.png', files['photo.png'], key, (200,))
            require(replay['data']['id'] == image, 'Upload replay changed identity')
            upload(left, conversation, 'photo.png', files['photo.png'] + b'x', key, (409,))
            r.start_worker()
            mark('pending/unbound denial and exact upload replay/conflict')
        wait(left, image)
        message = send(left, route(left, left_channel), conversation, [image])['message']
        content, headers = call('GET', f'{right}/chat-attachments/{image}/content', right)
        require(headers.get('Cache-Control') == 'no-store, private', 'Missing private delivery headers')
        require(headers.get('X-Content-Type-Options') == 'nosniff', 'Missing nosniff')
        require(content.startswith(b'\x89PNG'), 'Image rewrite did not produce PNG')
        call('GET', f'{right}/chat-attachments/{image}/preview', right)
        call('GET', f'{right}/chat-attachments/{image}', right, expected=(404,))
        ids = []
        for filename in ('clip.mp4', 'details.pdf'):
            asset = upload(right, conversation, filename, files[filename])['data']['id']
            wait(right, asset)
            ids.append(asset)
        send_key = str(uuid.uuid4())
        sent = send(right, route(right, right_channel), conversation, ids, send_key)['message']
        replay = send(right, route(right, right_channel), conversation, ids, send_key)['message']
        require(replay['id'] == sent['id'], 'Message replay duplicated persistence')
        send(right, route(right, right_channel), conversation, list(reversed(ids)), send_key, (409,))
        history = call('GET', f'{route(left, left_channel)}/{conversation}/messages', left)
        actual = next(m for m in history.get('items', history.get('data', [])) if m['id'] == sent['id'])
        require([a['id'] for a in actual['attachments']] == ids, 'Attachment order changed')
        for asset, filename in zip(actual['attachments'], ('clip.mp4', 'details.pdf')):
            content, headers = call('GET', asset['content_url'].removeprefix('/api/v1/'), left)
            require(content == files[filename], 'Received video/document bytes changed')
            call('GET', asset['content_url'].removeprefix('/api/v1/'), 'foreign', expected=(403, 404))
        video = actual['attachments'][0]
        preview, _ = call('GET', video['preview_url'].removeprefix('/api/v1/'), left)
        require(preview.startswith(b'\xff\xd8'), 'Video poster is not JPEG')
        chunk, _ = call('GET', video['content_url'].removeprefix('/api/v1/'), left,
                        expected=(206,), headers={'Range': 'bytes=0-31'})
        require(chunk == files['clip.mp4'][:32], 'Video byte range mismatch')
        call('GET', video['content_url'].removeprefix('/api/v1/'), left,
             expected=(416,), headers={'Range': 'bytes=999999999-'})
        if name == 'customer_courier':
            received['customer'] = (conversation, actual['attachments'])
        if name == 'operational':
            courier_history = call('GET', f'courier/operational-conversations/{conversation}/messages', 'courier')
            courier_image = next(m for m in courier_history['data'] if m['id'] == message['id'])['attachments']
            # The Courier consumes video/documents uploaded by its Logistics counterpart.
            received['courier'] = (conversation, courier_image)
        mark(f'{name}: real queued image/video/document exchange, history, ranges and replay')

    # Give Courier a received video/document pair, through its own message/history resources.
    conversation, image_attachments = received['courier']
    ids = [upload('logistics', conversation, n, files[n])['data']['id'] for n in ('clip.mp4', 'details.pdf')]
    for asset in ids:
        wait('logistics', asset)
    sent = send('logistics', 'logistics/operational-conversations', conversation, ids)['message']
    history = call('GET', f'courier/operational-conversations/{conversation}/messages', 'courier')
    received['courier'] = (conversation, next(m for m in history['data'] if m['id'] == sent['id'])['attachments'])

    malicious = base64.b64decode('WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=')
    infected = upload('customer', r.manifest['shop_thread'], 'check.txt', malicious)['data']['id']
    require(wait('customer', infected, 'rejected')['error_code'] == 'FILE_REJECTED', 'Scanner did not reject antivirus test content')
    send('customer', 'customer/conversations', r.manifest['shop_thread'], [infected], expected=(422,))
    mark('real malware rejection blocks binding')

    r.stop(r.worker)
    queued = upload('customer', r.manifest['shop_thread'], 'photo.png', files['photo.png'])['data']['id']
    time.sleep(2)
    require(call('GET', f'customer/chat-attachments/{queued}', 'customer')['data']['state'] == 'pending', 'Worker pause bypassed')
    r.start_worker()
    wait('customer', queued)
    mark('stopped worker preserves pending work; restart processes it')

    r.stop(r.worker)
    outage = upload('customer', r.manifest['shop_thread'], 'photo.png', files['photo.png'])['data']['id']
    r.start_worker(CHAT_MEDIA_CLAMAV_PORT='13311')
    wait('customer', outage, 'failed')
    # Use a separate cache directory so an earlier readiness result cannot mask the outage.
    r.command(['php', 'artisan', 'cache:clear'], 'clear-readiness')
    r.start_api(CHAT_MEDIA_CLAMAV_PORT='13311')
    require(not call('GET', 'customer/chat-attachments', 'customer')['data']['enabled'], 'Scanner outage enabled uploads')
    call('POST', f'customer/chat-attachments/{outage}/retry', 'customer', {}, (503,))
    r.start_api()
    r.start_worker()
    r.command(['php', 'artisan', 'cache:clear'], 'clear-readiness')
    call('POST', f'customer/chat-attachments/{outage}/retry', 'customer', {}, (200,))
    wait('customer', outage)
    mark('real scanner outage fails closed; bounded worker failure and explicit retry recover')

    r.start_api(CHAT_MEDIA_ENABLED='false')
    require(not call('GET', 'customer/chat-attachments', 'customer')['data']['enabled'], 'Disabled flag ignored')
    upload('customer', r.manifest['shop_thread'], 'photo.png', files['photo.png'], expected=(503,))
    call('GET', f'customer/chat-attachments/{first_asset}/content', 'customer')
    send('customer', 'customer/conversations', r.manifest['shop_thread'], [], body={'body': 'Synthetic text'})
    r.start_api()
    mark('disabled uploads preserve committed reads and text sends')

    courier_conversation, attachments = received['customer']
    r.control('end')
    detail = call('GET', f'customer/courier-conversations/{courier_conversation}', 'customer')['data']
    require(not detail['send_allowed'], 'Ended task retained send permission')
    send('customer', 'customer/courier-conversations', courier_conversation, [], expected=(409,), body={'body': 'Late'})
    call('GET', attachments[0]['content_url'].removeprefix('/api/v1/'), 'customer')
    call('GET', f'courier/chat-attachments/{attachments[0]["id"]}/content', 'courier')
    call('GET', f'courier/chat-attachments/{attachments[0]["id"]}/content', 'replacement', expected=(404,))
    r.control('reassign')
    call('GET', f'courier/operational-conversations/{courier_conversation}', 'replacement', expected=(404,))
    call('GET', f'courier/chat-attachments/{attachments[0]["id"]}/content', 'replacement', expected=(404,))
    r.control('restore')
    mark('ended read-only history and replacement-Courier media isolation')

    r.control('expire')
    r.command(['php', 'artisan', 'chat:maintain-media'], 'maintain')
    require(call('GET', f'customer/chat-attachments/{queued}', 'customer')['data']['state'] == 'deleted', 'Expired unbound cleanup failed')
    mark('real unbound retention cleanup preserves committed history')
    mark(verify_custody(r))
    for role, (conversation, attachments) in received.items():
        session = {'api_origin': r.origin.replace('127.0.0.1', 'localhost'),
                   'token': r.manifest['tokens'][role], 'conversation_id': conversation,
                   'attachments': attachments}
        (r.root / f'{role}-session.json').write_text(json.dumps(session))
    return {'passed': True, 'scanner': version, 'checks': checks,
            'scope': 'isolated local SQLite/private filesystem/real media worker/real ClamAV; no deployed acceptance'}
