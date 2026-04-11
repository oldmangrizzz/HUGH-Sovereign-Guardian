#!/usr/bin/env python3.12
"""
Pangolin MCP Server
Exposes Pangolin/Traefik infrastructure management as MCP tools.
Connects to Workshop Charlie (76.13.146.61) via SSH.
"""

import asyncio
import json
import subprocess
import hashlib
import time
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

CHARLIE_HOST = "root@76.13.146.61"
PANGOLIN_DB = "/opt/pangolin/config/db/db.sqlite"
PANGOLIN_CONFIG = "/opt/pangolin/config/config.yml"
TRAEFIK_WORKSHOP_YML = "/opt/pangolin/config/traefik/workshop.yml"

def ssh(cmd: str) -> tuple[str, str, int]:
    """Run a command on Workshop Charlie via SSH."""
    result = subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10", CHARLIE_HOST, cmd],
        capture_output=True, text=True
    )
    return result.stdout, result.stderr, result.returncode

def ssh_python(script: str) -> str:
    """Run Python script on Charlie and return stdout."""
    out, err, code = ssh(f"python3 << 'PYEOF'\n{script}\nPYEOF")
    if code != 0:
        return f"ERROR (exit {code}):\n{err}\n{out}"
    return out.strip()

app = Server("pangolin-mcp")

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="pangolin_list_resources",
            description="List all Pangolin resources with their auth config and status",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="pangolin_list_sessions",
            description="List active and pending sessions for a resource or all resources",
            inputSchema={
                "type": "object",
                "properties": {
                    "resource_id": {"type": "integer", "description": "Resource ID (omit for all)"}
                }
            }
        ),
        types.Tool(
            name="pangolin_clean_sessions",
            description="Delete all expired resource sessions from the DB",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="pangolin_list_users",
            description="List all Pangolin users with their org membership and roles",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="pangolin_verify_session",
            description="Test the verify-session Badger endpoint for a given host and optional cookie",
            inputSchema={
                "type": "object",
                "required": ["host"],
                "properties": {
                    "host": {"type": "string", "description": "Hostname to check, e.g. natasha.grizzlymedicine.icu"},
                    "cookie_name": {"type": "string", "description": "Cookie name (optional)"},
                    "cookie_value": {"type": "string", "description": "Cookie value (optional)"}
                }
            }
        ),
        types.Tool(
            name="pangolin_test_exchange",
            description="Create a test resource session and call exchange-session to verify the full auth flow works",
            inputSchema={
                "type": "object",
                "required": ["host", "resource_id"],
                "properties": {
                    "host": {"type": "string"},
                    "resource_id": {"type": "integer"}
                }
            }
        ),
        types.Tool(
            name="pangolin_get_config",
            description="Get the current Pangolin config.yml and Traefik workshop.yml",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="pangolin_fix_middleware_param",
            description="Fix Badger middleware resourceSessionRequestParam to match Pangolin's config",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="pangolin_add_resource",
            description="Register a new resource in Pangolin (inserts into DB with proper access grants)",
            inputSchema={
                "type": "object",
                "required": ["name", "full_domain"],
                "properties": {
                    "name": {"type": "string"},
                    "full_domain": {"type": "string"},
                    "sso": {"type": "boolean", "default": True},
                    "user_id": {"type": "string", "description": "User ID to grant access (default: Grizz)"}
                }
            }
        ),
        types.Tool(
            name="pangolin_container_logs",
            description="Get recent logs from a container on Workshop Charlie",
            inputSchema={
                "type": "object",
                "required": ["container"],
                "properties": {
                    "container": {"type": "string", "description": "Container name: pangolin, traefik, natasha-zero, gerbil"},
                    "lines": {"type": "integer", "default": 50},
                    "since": {"type": "string", "default": "5m", "description": "Time window e.g. 5m, 1h"}
                }
            }
        ),
        types.Tool(
            name="pangolin_container_status",
            description="List all Docker containers on Workshop Charlie with status",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="charlie_run_command",
            description="Run an arbitrary shell command on Workshop Charlie (use with care)",
            inputSchema={
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {"type": "string"}
                }
            }
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    result = await _dispatch(name, arguments)
    return [types.TextContent(type="text", text=result)]

async def _dispatch(name: str, args: dict) -> str:
    if name == "pangolin_list_resources":
        return _list_resources()
    elif name == "pangolin_list_sessions":
        return _list_sessions(args.get("resource_id"))
    elif name == "pangolin_clean_sessions":
        return _clean_sessions()
    elif name == "pangolin_list_users":
        return _list_users()
    elif name == "pangolin_verify_session":
        return _verify_session(args["host"], args.get("cookie_name"), args.get("cookie_value"))
    elif name == "pangolin_test_exchange":
        return _test_exchange(args["host"], args["resource_id"])
    elif name == "pangolin_get_config":
        return _get_config()
    elif name == "pangolin_fix_middleware_param":
        return _fix_middleware_param()
    elif name == "pangolin_add_resource":
        return _add_resource(args["name"], args["full_domain"], args.get("sso", True), args.get("user_id"))
    elif name == "pangolin_container_logs":
        return _container_logs(args["container"], args.get("lines", 50), args.get("since", "5m"))
    elif name == "pangolin_container_status":
        return _container_status()
    elif name == "charlie_run_command":
        out, err, code = ssh(args["command"])
        return f"Exit {code}\nSTDOUT:\n{out}\nSTDERR:\n{err}"
    else:
        return f"Unknown tool: {name}"

def _list_resources() -> str:
    script = f"""
import sqlite3, json
conn = sqlite3.connect('{PANGOLIN_DB}')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("""
    script += """
    SELECT r.resourceId, r.name, r.fullDomain, r.sso, r.ssl, r.blockAccess,
           COUNT(rr.roleId) as role_count, COUNT(ur.userId) as user_count
    FROM resources r
    LEFT JOIN roleResources rr ON r.resourceId = rr.resourceId
    LEFT JOIN userResources ur ON r.resourceId = ur.resourceId
    GROUP BY r.resourceId
    ORDER BY r.resourceId
"""
    script += f"""
)
rows = [dict(r) for r in cur.fetchall()]
print(json.dumps(rows, indent=2))
conn.close()
"""
    return ssh_python(script)

def _list_sessions(resource_id=None) -> str:
    where = f"WHERE resourceId={resource_id}" if resource_id else ""
    script = f"""
import sqlite3, json, time
conn = sqlite3.connect('{PANGOLIN_DB}')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
now = int(time.time()*1000)
cur.execute('''
    SELECT resourceId, isRequestToken,
           COUNT(*) as count,
           SUM(CASE WHEN expiresAt > {'{}'} THEN 1 ELSE 0 END) as fresh,
           SUM(CASE WHEN expiresAt <= {'{}'} THEN 1 ELSE 0 END) as expired
    FROM resourceSessions {where}
    GROUP BY resourceId, isRequestToken
    ORDER BY resourceId, isRequestToken
'''.format(now, now))
rows = [dict(r) for r in cur.fetchall()]
print(json.dumps(rows, indent=2))
conn.close()
""".replace("{where}", where)
    return ssh_python(script)

def _clean_sessions() -> str:
    script = f"""
import sqlite3, time
conn = sqlite3.connect('{PANGOLIN_DB}')
cur = conn.cursor()
now = int(time.time()*1000)
cur.execute('DELETE FROM resourceSessions WHERE expiresAt < ?', (now,))
deleted = cur.rowcount
conn.commit()
cur.execute('SELECT COUNT(*) FROM resourceSessions')
remaining = cur.fetchone()[0]
conn.close()
print(f'Deleted {{deleted}} expired sessions. {{remaining}} sessions remain.')
"""
    return ssh_python(script)

def _list_users() -> str:
    script = f"""
import sqlite3, json
conn = sqlite3.connect('{PANGOLIN_DB}')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute('''
    SELECT u.id, u.email, u.name, u.serverAdmin, u.emailVerified,
           GROUP_CONCAT(uo.orgId) as orgs
    FROM user u
    LEFT JOIN userOrgs uo ON u.id = uo.userId
    GROUP BY u.id
''')
rows = [dict(r) for r in cur.fetchall()]
print(json.dumps(rows, indent=2))
conn.close()
"""
    return ssh_python(script)

def _verify_session(host: str, cookie_name=None, cookie_value=None) -> str:
    sessions = {}
    if cookie_name and cookie_value:
        sessions[cookie_name] = cookie_value
    payload = json.dumps({
        "sessions": sessions,
        "originalRequestURL": f"https://{host}/",
        "scheme": "https",
        "host": host,
        "path": "/",
        "method": "GET",
        "tls": True
    })
    script = f"""
import http.client, json
conn = http.client.HTTPConnection("localhost", 3001, timeout=10)
body = {repr(payload)}
conn.request("POST", "/api/v1/badger/verify-session", body=body, headers={{"Content-Type": "application/json"}})
try:
    r = conn.getresponse()
    print("Status:", r.status)
    print(r.read().decode())
except Exception as e:
    print("ERROR:", e)
finally:
    conn.close()
"""
    return ssh_python(script)

def _test_exchange(host: str, resource_id: int) -> str:
    raw_token = f"mcp-test-{int(time.time())}"
    session_id = hashlib.sha256(raw_token.encode()).hexdigest()
    payload = json.dumps({"requestToken": raw_token, "host": host})
    script = f"""
import sqlite3, http.client, json, time
db = sqlite3.connect('{PANGOLIN_DB}')
cur = db.cursor()
now_ms = int(time.time()*1000)
expires = now_ms + 60000

# Get a valid user session for the resource
cur.execute('SELECT id FROM session ORDER BY expiresAt DESC LIMIT 1')
row = cur.fetchone()
user_sess_id = row[0] if row else None

# Insert test request token
cur.execute(
    'INSERT INTO resourceSessions (id, resourceId, expiresAt, sessionLength, doNotExtend, isRequestToken, userSessionId, issuedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ({repr(session_id)}, {resource_id}, expires, 30000, 0, 1, user_sess_id, now_ms)
)
db.commit()
print("Inserted test session, userSessionId:", user_sess_id)

conn = http.client.HTTPConnection("localhost", 3001, timeout=15)
body = {repr(payload)}
conn.request("POST", "/api/v1/badger/exchange-session", body=body, headers={{"Content-Type": "application/json"}})
try:
    r = conn.getresponse()
    resp = json.loads(r.read())
    print("exchange-session status:", r.status)
    print(json.dumps(resp, indent=2))
    if resp.get("data", {{}}).get("cookie"):
        # Now test verify-session with the cookie
        cookie = resp["data"]["cookie"]
        parts = cookie.split(";")[0].strip()
        cname, cval = parts.split("=", 1)
        conn2 = http.client.HTTPConnection("localhost", 3001, timeout=10)
        body2 = json.dumps({{
            "sessions": {{cname: cval}},
            "originalRequestURL": "https://{host}/",
            "scheme": "https", "host": "{host}", "path": "/",
            "method": "GET", "tls": True
        }})
        conn2.request("POST", "/api/v1/badger/verify-session", body=body2, headers={{"Content-Type": "application/json"}})
        r2 = conn2.getresponse()
        resp2 = json.loads(r2.read())
        print("verify-session with new cookie:", r2.status, resp2.get("data", {{}}).get("valid"))
        conn2.close()
except Exception as e:
    print("ERROR:", e)
finally:
    conn.close()
    db.close()
"""
    return ssh_python(script)

def _get_config() -> str:
    out, _, _ = ssh(f"cat {PANGOLIN_CONFIG} && echo '---WORKSHOP.YML---' && cat {TRAEFIK_WORKSHOP_YML}")
    return out

def _fix_middleware_param() -> str:
    script_check = f"""
import subprocess
result = subprocess.run(['grep', 'resourceSessionRequestParam', '{TRAEFIK_WORKSHOP_YML}'], capture_output=True, text=True)
print(result.stdout.strip())
"""
    current = ssh_python(script_check)
    out, err, code = ssh(
        f"grep -c 'resource_session_request_param' {TRAEFIK_WORKSHOP_YML}"
    )
    if out.strip() == "1":
        return f"Already correct. Current value:\n{current}"
    # Fix it
    fix_out, fix_err, fix_code = ssh(
        f"sed -i 's/p_session_request/resource_session_request_param/g' {TRAEFIK_WORKSHOP_YML} && "
        f"echo 'Fixed' && cat {TRAEFIK_WORKSHOP_YML}"
    )
    return fix_out if fix_code == 0 else f"Fix failed: {fix_err}"

def _add_resource(name: str, full_domain: str, sso: bool = True, user_id: str = None) -> str:
    sso_int = 1 if sso else 0
    uid = user_id or "dpb3ll1mgqcrvrq"
    script = f"""
import sqlite3, uuid
conn = sqlite3.connect('{PANGOLIN_DB}')
cur = conn.cursor()

# Find next resourceId
cur.execute('SELECT MAX(resourceId) FROM resources')
max_id = cur.fetchone()[0] or 0
new_id = max_id + 1
guid = str(uuid.uuid4())

# Get org id
cur.execute('SELECT orgId FROM orgs LIMIT 1')
org_id = cur.fetchone()[0]

cur.execute('''
    INSERT INTO resources (resourceId, name, orgId, fullDomain, sso, ssl, blockAccess)
    VALUES (?, ?, ?, ?, ?, 0, 0)
''', (new_id, {repr(name)}, org_id, {repr(full_domain)}, {sso_int}))

# Grant admin role
cur.execute('SELECT roleId FROM roles WHERE name="Admin" LIMIT 1')
admin_role = cur.fetchone()
if admin_role:
    cur.execute('INSERT OR IGNORE INTO roleResources (roleId, resourceId) VALUES (?, ?)',
                (admin_role[0], new_id))

# Grant specific user
cur.execute('INSERT OR IGNORE INTO userResources (userId, resourceId) VALUES (?, ?)',
            ({repr(uid)}, new_id))

conn.commit()
print(f'Created resource: id={{new_id}}, name={repr(name)}, domain={repr(full_domain)}, guid={{guid}}')
conn.close()
"""
    return ssh_python(script)

def _container_logs(container: str, lines: int = 50, since: str = "5m") -> str:
    out, err, code = ssh(f"docker logs {container} --since={since} 2>&1 | tail -{lines}")
    return out if code == 0 else f"Error: {err}"

def _container_status() -> str:
    out, _, _ = ssh("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null")
    return out

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
