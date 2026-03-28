import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from sentence_transformers import SentenceTransformer


HOST = os.environ.get('BGE_SERVER_HOST', '127.0.0.1')
PORT = int(os.environ.get('BGE_SERVER_PORT', '8787'))
MODEL_NAME = os.environ.get('BGE_MODEL_NAME', 'bge-small-zh-v1.5')
MODEL_PATH = Path(
    os.environ.get(
        'BGE_MODEL_PATH',
        str(Path(__file__).resolve().parents[1] / 'local-models' / MODEL_NAME),
    ),
)


print(f'Loading embedding model from: {MODEL_PATH}', flush=True)
MODEL = SentenceTransformer(str(MODEL_PATH))
print('Model loaded.', flush=True)


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class EmbeddingHandler(BaseHTTPRequestHandler):
    server_version = 'LocalBGEEmbeddingServer/1.0'

    def log_message(self, format: str, *args):
        sys.stdout.write(
            '%s - - [%s] %s\n'
            % (
                self.address_string(),
                self.log_date_time_string(),
                format % args,
            ),
        )
        sys.stdout.flush()

    def do_GET(self):
        if self.path in ('/health', '/v1/health'):
            json_response(
                self,
                200,
                {
                    'status': 'ok',
                    'model': MODEL_NAME,
                    'path': str(MODEL_PATH),
                },
            )
            return

        if self.path == '/v1/models':
            json_response(
                self,
                200,
                {
                    'object': 'list',
                    'data': [
                        {
                            'id': MODEL_NAME,
                            'object': 'model',
                            'created': int(time.time()),
                            'owned_by': 'local',
                        },
                    ],
                },
            )
            return

        json_response(
            self,
            404,
            {
                'error': {
                    'message': f'Unknown path: {self.path}',
                    'type': 'not_found',
                },
            },
        )

    def do_POST(self):
        if self.path != '/v1/embeddings':
            json_response(
                self,
                404,
                {
                    'error': {
                        'message': f'Unknown path: {self.path}',
                        'type': 'not_found',
                    },
                },
            )
            return

        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode('utf-8'))
        except Exception as error:
            json_response(
                self,
                400,
                {
                    'error': {
                        'message': f'Invalid JSON body: {error}',
                        'type': 'invalid_request_error',
                    },
                },
            )
            return

        model = payload.get('model', MODEL_NAME)
        user_input = payload.get('input')

        if user_input is None:
            json_response(
                self,
                400,
                {
                    'error': {
                        'message': '"input" is required',
                        'type': 'invalid_request_error',
                    },
                },
            )
            return

        if isinstance(user_input, str):
            inputs = [user_input]
        elif isinstance(user_input, list) and all(
            isinstance(item, str) for item in user_input
        ):
            inputs = user_input
        else:
            json_response(
                self,
                400,
                {
                    'error': {
                        'message': '"input" must be a string or a list of strings',
                        'type': 'invalid_request_error',
                    },
                },
            )
            return

        try:
            vectors = MODEL.encode(inputs, normalize_embeddings=False)
            data = [
                {
                    'object': 'embedding',
                    'index': index,
                    'embedding': vector.tolist(),
                }
                for index, vector in enumerate(vectors)
            ]
            json_response(
                self,
                200,
                {
                    'object': 'list',
                    'data': data,
                    'model': model,
                    'usage': {
                        'prompt_tokens': 0,
                        'total_tokens': 0,
                    },
                },
            )
        except Exception as error:
            json_response(
                self,
                500,
                {
                    'error': {
                        'message': str(error),
                        'type': 'server_error',
                    },
                },
            )


def main():
    server = ThreadingHTTPServer((HOST, PORT), EmbeddingHandler)
    print(f'Serving embeddings at http://{HOST}:{PORT}/v1/embeddings', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
