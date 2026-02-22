#!/usr/bin/env python3
"""WebSocket Proxy Server for Gemini Live API.
Deployed on Cloud Run. Serves HTTP health checks and WebSocket proxy on the same port.
"""

import asyncio
import json
import os
import ssl

import certifi
import google.auth
import websockets
from aiohttp import web
from google.auth.transport.requests import Request
from websockets.exceptions import ConnectionClosed

PORT = int(os.environ.get("PORT", 8080))


def generate_access_token():
    """Retrieves an access token using Google Cloud default credentials."""
    try:
        creds, _ = google.auth.default()
        if not creds.valid:
            creds.refresh(Request())
        return creds.token
    except Exception as e:
        print(f"Error generating access token: {e}")
        return None


async def proxy_task(source_ws, dest_ws, label):
    """Forward messages between two WebSocket connections."""
    try:
        async for message in source_ws:
            try:
                data = json.loads(message)
                await dest_ws.send(json.dumps(data))
            except Exception as e:
                print(f"Error proxying from {label}: {e}")
    except ConnectionClosed as e:
        print(f"{label} connection closed: {e.code}")
    except Exception as e:
        print(f"Unexpected error in {label} proxy: {e}")
    finally:
        try:
            await dest_ws.close()
        except Exception:
            pass


async def create_proxy(client_ws, bearer_token, service_url):
    """Establish bidirectional proxy between client and Gemini."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer_token}",
    }
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    print("Connecting to Gemini Live API...")
    try:
        async with websockets.connect(
            service_url, additional_headers=headers, ssl=ssl_context
        ) as server_ws:
            print("✅ Connected to Gemini Live API")

            c2s = asyncio.create_task(
                proxy_task(client_ws, server_ws, "client→server")
            )
            s2c = asyncio.create_task(
                proxy_task(server_ws, client_ws, "server→client")
            )

            done, pending = await asyncio.wait(
                [c2s, s2c], return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except ConnectionClosed as e:
        print(f"Server connection closed: {e.code} - {e.reason}")
    except Exception as e:
        print(f"Failed to connect to Gemini API: {e}")


async def websocket_handler(request):
    """Handle WebSocket upgrade from aiohttp."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    print("🔌 New WebSocket client via aiohttp...")
    try:
        setup_raw = await asyncio.wait_for(ws.receive_str(), timeout=10.0)
        setup_data = json.loads(setup_raw)

        bearer_token = setup_data.get("bearer_token")
        service_url = setup_data.get("service_url")

        if not bearer_token:
            print("🔑 Generating access token...")
            bearer_token = generate_access_token()
            if not bearer_token:
                print("❌ Failed to generate access token")
                await ws.close(code=1008, message=b"Authentication failed")
                return ws

        if not service_url:
            await ws.close(code=1008, message=b"Service URL required")
            return ws

        # Create SSL context
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {bearer_token}",
        }
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        print("Connecting to Gemini Live API...")
        async with websockets.connect(
            service_url, additional_headers=headers, ssl=ssl_context
        ) as gemini_ws:
            print("✅ Connected to Gemini Live API")

            async def client_to_gemini():
                try:
                    async for msg in ws:
                        if msg.type == web.WSMsgType.TEXT:
                            await gemini_ws.send(msg.data)
                        elif msg.type in (
                            web.WSMsgType.CLOSE,
                            web.WSMsgType.ERROR,
                        ):
                            break
                except Exception as e:
                    print(f"Client→Gemini error: {e}")
                finally:
                    await gemini_ws.close()

            async def gemini_to_client():
                try:
                    async for message in gemini_ws:
                        if ws.closed:
                            break
                        await ws.send_str(
                            message
                            if isinstance(message, str)
                            else message.decode()
                        )
                except ConnectionClosed:
                    pass
                except Exception as e:
                    print(f"Gemini→Client error: {e}")
                finally:
                    if not ws.closed:
                        await ws.close()

            c2g = asyncio.create_task(client_to_gemini())
            g2c = asyncio.create_task(gemini_to_client())
            done, pending = await asyncio.wait(
                [c2g, g2c], return_when=asyncio.FIRST_COMPLETED
            )
            for t in pending:
                t.cancel()

    except asyncio.TimeoutError:
        print("⏱️ Timeout waiting for setup")
        await ws.close(code=1008, message=b"Timeout")
    except Exception as e:
        print(f"❌ Error: {e}")
        if not ws.closed:
            await ws.close(code=1011, message=b"Internal error")

    return ws


async def health_check(request):
    """Health check for Cloud Run."""
    return web.Response(
        text=json.dumps({"status": "ok"}),
        content_type="application/json",
        headers={
            "Access-Control-Allow-Origin": "*",
        },
    )


async def options_handler(request):
    """CORS preflight."""
    return web.Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


def main():
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_options("/{path:.*}", options_handler)

    print(f"🚀 Starting server on port {PORT}")
    web.run_app(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
