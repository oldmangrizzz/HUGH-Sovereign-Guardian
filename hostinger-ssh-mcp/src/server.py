"""
Hostinger VPS SSH MCP Server
A Model Context Protocol server for managing a remote VPS via SSH/SFTP.
"""
import json
import logging
import os
import sys
import signal
import base64
from typing import Optional, Annotated

import paramiko
from mcp.server.fastmcp import FastMCP
from pydantic import Field

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("hostinger-ssh-mcp")

# Configuration from environment
SSH_HOST = os.getenv("SSH_HOST", "187.124.28.147")
SSH_PORT = int(os.getenv("SSH_PORT", "22"))
SSH_USER = os.getenv("SSH_USER", "root")
SSH_PASSWORD = os.getenv("SSH_PASSWORD", "")
SSH_KEY_PATH = os.getenv("SSH_KEY_PATH", "")

mcp = FastMCP("HostingerSSH")


def get_ssh_client() -> paramiko.SSHClient:
    """Create and return a connected SSH client."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": SSH_HOST,
        "port": SSH_PORT,
        "username": SSH_USER,
        "timeout": 15,
        "allow_agent": False,
        "look_for_keys": False,
    }
    if SSH_KEY_PATH and os.path.exists(SSH_KEY_PATH):
        connect_kwargs["key_filename"] = SSH_KEY_PATH
    elif SSH_PASSWORD:
        connect_kwargs["password"] = SSH_PASSWORD
    else:
        raise ValueError("No SSH credentials configured (set SSH_PASSWORD or SSH_KEY_PATH)")
    client.connect(**connect_kwargs)
    return client


def run_command(cmd: str, timeout: int = 30) -> dict:
    """Execute a command over SSH and return stdout/stderr/exit_code."""
    client = get_ssh_client()
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        return {
            "stdout": stdout.read().decode("utf-8", errors="replace"),
            "stderr": stderr.read().decode("utf-8", errors="replace"),
            "exit_code": exit_code,
        }
    finally:
        client.close()


# ─── System Tools ───────────────────────────────────────────────────────────────

@mcp.tool(description="Execute a shell command on the Hostinger VPS. Returns stdout, stderr, and exit code.")
def execute_command(
    command: Annotated[str, Field(description="Shell command to execute on the remote VPS")],
    timeout: Annotated[int, Field(description="Command timeout in seconds", default=30)] = 30,
):
    result = run_command(command, timeout=timeout)
    output = f"$ {command}\n"
    if result["stdout"]:
        output += result["stdout"]
    if result["stderr"]:
        output += f"\nSTDERR:\n{result['stderr']}"
    output += f"\n[exit code: {result['exit_code']}]"
    return output


@mcp.tool(description="Get comprehensive system information: hostname, OS, CPU, memory, disk, uptime, network interfaces.")
def get_system_info():
    commands = {
        "hostname": "hostname -f",
        "os": "cat /etc/os-release | head -4",
        "uptime": "uptime -p",
        "cpu": "nproc && lscpu | grep 'Model name'",
        "memory": "free -h",
        "disk": "df -h | grep -E '^/dev|^Filesystem'",
        "load": "cat /proc/loadavg",
        "ip_addresses": "ip -4 addr show | grep inet | awk '{print $NF, $2}'",
    }
    output = "🖥️ Hostinger VPS System Info\n\n"
    for label, cmd in commands.items():
        result = run_command(cmd)
        output += f"── {label.upper()} ──\n{result['stdout'].strip()}\n\n"
    return output


@mcp.tool(description="Check resource usage: CPU percentage, memory usage, top processes.")
def get_resource_usage(
    top_n: Annotated[int, Field(description="Number of top processes to show", default=10)] = 10,
):
    cmd = f"""
echo '=== CPU ===' && top -bn1 | head -3 && \
echo '\\n=== MEMORY ===' && free -h && \
echo '\\n=== TOP {top_n} PROCESSES ===' && ps aux --sort=-%mem | head -{top_n + 1}
"""
    result = run_command(cmd)
    return f"📊 Resource Usage\n\n{result['stdout']}"


# ─── Docker Tools ───────────────────────────────────────────────────────────────

@mcp.tool(description="List running Docker containers with status, ports, and resource usage.")
def docker_list_containers(
    all_containers: Annotated[bool, Field(description="Include stopped containers", default=False)] = False,
):
    flag = "-a" if all_containers else ""
    result = run_command(f"docker ps {flag} --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Image}}}}\\t{{{{.Ports}}}}'")
    stats = run_command("docker stats --no-stream --format 'table {{{{.Name}}}}\\t{{{{.CPUPerc}}}}\\t{{{{.MemUsage}}}}' 2>/dev/null")
    output = f"🐳 Docker Containers\n\n{result['stdout']}"
    if stats["exit_code"] == 0:
        output += f"\n── RESOURCE USAGE ──\n{stats['stdout']}"
    return output


@mcp.tool(description="Get logs from a Docker container.")
def docker_logs(
    container: Annotated[str, Field(description="Container name or ID")],
    lines: Annotated[int, Field(description="Number of log lines to retrieve", default=50)] = 50,
):
    result = run_command(f"docker logs --tail {lines} {container} 2>&1")
    return f"📋 Logs for '{container}' (last {lines} lines)\n\n{result['stdout']}"


@mcp.tool(description="Execute a command inside a running Docker container.")
def docker_exec(
    container: Annotated[str, Field(description="Container name or ID")],
    command: Annotated[str, Field(description="Command to execute inside the container")],
):
    result = run_command(f"docker exec {container} {command}")
    output = f"🐳 docker exec {container} {command}\n\n{result['stdout']}"
    if result["stderr"]:
        output += f"\nSTDERR: {result['stderr']}"
    return output


@mcp.tool(description="Start, stop, or restart a Docker container.")
def docker_control(
    container: Annotated[str, Field(description="Container name or ID")],
    action: Annotated[str, Field(description="Action: start, stop, restart, pause, unpause")],
):
    if action not in ("start", "stop", "restart", "pause", "unpause"):
        return f"Invalid action '{action}'. Use: start, stop, restart, pause, unpause"
    result = run_command(f"docker {action} {container}")
    status = run_command(f"docker ps -a --filter name={container} --format '{{{{.Names}}}} {{{{.Status}}}}'")
    return f"🐳 docker {action} {container}\n{result['stdout']}{result['stderr']}\nCurrent status: {status['stdout'].strip()}"


@mcp.tool(description="Run docker-compose commands (up, down, pull, build, etc.) in a specified directory.")
def docker_compose(
    directory: Annotated[str, Field(description="Directory containing docker-compose.yml")],
    action: Annotated[str, Field(description="Compose action: up -d, down, pull, build, logs, ps")],
):
    result = run_command(f"cd {directory} && docker compose {action} 2>&1", timeout=120)
    return f"🐳 docker compose {action} (in {directory})\n\n{result['stdout']}"


# ─── File Management Tools ─────────────────────────────────────────────────────

@mcp.tool(description="List files and directories at a given path on the VPS.")
def list_directory(
    path: Annotated[str, Field(description="Remote directory path", default="/")] = "/",
    show_hidden: Annotated[bool, Field(description="Include hidden files", default=False)] = False,
):
    flag = "-lah" if show_hidden else "-lh"
    result = run_command(f"ls {flag} {path}")
    return f"📁 {path}\n\n{result['stdout']}"


@mcp.tool(description="Read the contents of a file on the VPS. Supports text files and config files.")
def read_file(
    path: Annotated[str, Field(description="Full path to the file")],
    lines: Annotated[Optional[int], Field(description="Max lines to read (None=all)", default=200)] = 200,
):
    cmd = f"head -n {lines} '{path}'" if lines else f"cat '{path}'"
    result = run_command(cmd)
    if result["exit_code"] != 0:
        return f"❌ Error reading {path}: {result['stderr']}"
    return f"📄 {path}\n\n{result['stdout']}"


@mcp.tool(description="Write content to a file on the VPS. Creates the file if it doesn't exist.")
def write_file(
    path: Annotated[str, Field(description="Full path for the file")],
    content: Annotated[str, Field(description="Content to write to the file")],
    append: Annotated[bool, Field(description="Append instead of overwrite", default=False)] = False,
):
    client = get_ssh_client()
    try:
        sftp = client.open_sftp()
        mode = "a" if append else "w"
        with sftp.open(path, mode) as f:
            f.write(content)
        sftp.close()
        return f"✅ {'Appended to' if append else 'Wrote'} {path} ({len(content)} bytes)"
    except Exception as e:
        return f"❌ Error writing {path}: {e}"
    finally:
        client.close()


@mcp.tool(description="Search for files by name pattern on the VPS.")
def find_files(
    path: Annotated[str, Field(description="Directory to search in")],
    pattern: Annotated[str, Field(description="File name pattern (e.g., '*.conf', 'docker-compose*')")],
    max_depth: Annotated[int, Field(description="Maximum directory depth to search", default=5)] = 5,
):
    result = run_command(f"find {path} -maxdepth {max_depth} -name '{pattern}' 2>/dev/null | head -50")
    return f"🔍 Find '{pattern}' in {path}\n\n{result['stdout'] or 'No matches found.'}"


@mcp.tool(description="Search file contents using grep on the VPS.")
def search_in_files(
    path: Annotated[str, Field(description="Directory or file to search in")],
    pattern: Annotated[str, Field(description="Search pattern (regex supported)")],
    file_pattern: Annotated[str, Field(description="File type filter (e.g., '*.py', '*.conf')", default="")] = "",
):
    include = f"--include='{file_pattern}'" if file_pattern else ""
    result = run_command(f"grep -rn {include} '{pattern}' {path} 2>/dev/null | head -50")
    return f"🔍 grep '{pattern}' in {path}\n\n{result['stdout'] or 'No matches found.'}"


# ─── Service Management ────────────────────────────────────────────────────────

@mcp.tool(description="List systemd services and their status on the VPS.")
def list_services(
    state: Annotated[str, Field(description="Filter by state: running, failed, all", default="running")] = "running",
):
    if state == "all":
        cmd = "systemctl list-units --type=service --no-pager"
    elif state == "failed":
        cmd = "systemctl list-units --type=service --state=failed --no-pager"
    else:
        cmd = "systemctl list-units --type=service --state=running --no-pager"
    result = run_command(cmd)
    return f"⚙️ Services ({state})\n\n{result['stdout']}"


@mcp.tool(description="Control a systemd service: start, stop, restart, enable, disable, status.")
def service_control(
    service: Annotated[str, Field(description="Service name (e.g., 'nginx', 'docker')")],
    action: Annotated[str, Field(description="Action: start, stop, restart, enable, disable, status")],
):
    if action not in ("start", "stop", "restart", "enable", "disable", "status"):
        return f"Invalid action. Use: start, stop, restart, enable, disable, status"
    result = run_command(f"systemctl {action} {service} 2>&1")
    status = run_command(f"systemctl is-active {service}")
    return f"⚙️ systemctl {action} {service}\n{result['stdout']}\nCurrent state: {status['stdout'].strip()}"


# ─── Network Tools ──────────────────────────────────────────────────────────────

@mcp.tool(description="Check listening ports and active network connections on the VPS.")
def network_info():
    ports = run_command("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null")
    firewall = run_command("ufw status 2>/dev/null || iptables -L -n --line-numbers 2>/dev/null | head -30")
    return f"🌐 Network Info\n\n── LISTENING PORTS ──\n{ports['stdout']}\n── FIREWALL ──\n{firewall['stdout']}"


@mcp.tool(description="Test connectivity from the VPS to a host (ping or curl).")
def test_connectivity(
    target: Annotated[str, Field(description="Hostname or IP to test")],
    method: Annotated[str, Field(description="Method: ping, curl, dig", default="ping")] = "ping",
):
    if method == "ping":
        result = run_command(f"ping -c 3 -W 5 {target}")
    elif method == "curl":
        result = run_command(f"curl -sI -m 10 {target}")
    elif method == "dig":
        result = run_command(f"dig +short {target}")
    else:
        return "Invalid method. Use: ping, curl, dig"
    return f"🌐 {method} {target}\n\n{result['stdout']}"


# ─── Security Tools ─────────────────────────────────────────────────────────────

@mcp.tool(description="Check recent SSH login attempts and security events.")
def security_check():
    cmds = {
        "Failed SSH logins (last 20)": "grep 'Failed password' /var/log/auth.log 2>/dev/null | tail -20 || journalctl -u ssh --no-pager -n 20 --grep='Failed'",
        "Last successful logins": "last -n 10",
        "Listening services": "ss -tlnp | head -20",
    }
    output = "🛡️ Security Check\n\n"
    for label, cmd in cmds.items():
        result = run_command(cmd)
        output += f"── {label} ──\n{result['stdout'].strip()}\n\n"
    return output


# ─── Package Management ────────────────────────────────────────────────────────

@mcp.tool(description="Manage packages: install, remove, update, search, or list installed packages.")
def package_management(
    action: Annotated[str, Field(description="Action: install, remove, update, search, list-installed")],
    package: Annotated[str, Field(description="Package name (required for install/remove/search)", default="")] = "",
):
    if action == "update":
        result = run_command("apt update && apt upgrade -y 2>&1", timeout=300)
    elif action == "install" and package:
        result = run_command(f"apt install -y {package} 2>&1", timeout=120)
    elif action == "remove" and package:
        result = run_command(f"apt remove -y {package} 2>&1", timeout=60)
    elif action == "search" and package:
        result = run_command(f"apt search {package} 2>&1 | head -30")
    elif action == "list-installed":
        result = run_command("dpkg --list | tail -30")
    else:
        return "Provide a valid action (install/remove/update/search/list-installed) and package name if needed."
    return f"📦 apt {action} {package}\n\n{result['stdout']}"


# ─── Cron Management ───────────────────────────────────────────────────────────

@mcp.tool(description="List or manage cron jobs on the VPS.")
def cron_management(
    action: Annotated[str, Field(description="Action: list, add, remove", default="list")] = "list",
    schedule: Annotated[str, Field(description="Cron schedule (e.g., '0 * * * *')", default="")] = "",
    command: Annotated[str, Field(description="Command for the cron job", default="")] = "",
):
    if action == "list":
        result = run_command("crontab -l 2>&1")
        return f"⏰ Cron Jobs\n\n{result['stdout']}"
    elif action == "add" and schedule and command:
        result = run_command(f'(crontab -l 2>/dev/null; echo "{schedule} {command}") | crontab -')
        return f"✅ Added cron: {schedule} {command}"
    elif action == "remove":
        return "To remove a cron job, use execute_command with: crontab -e or provide the specific entry to remove."
    return "Invalid cron action."


# ─── Server Entry Point ────────────────────────────────────────────────────────

def main():
    import anyio

    def signal_handler(signum, frame):
        logger.info("Shutting down SSH MCP server...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info(f"Starting Hostinger SSH MCP server (target: {SSH_USER}@{SSH_HOST}:{SSH_PORT})")

    # Validate connectivity on startup
    try:
        client = get_ssh_client()
        client.close()
        logger.info("SSH connection validated successfully")
    except Exception as e:
        logger.error(f"SSH connection failed: {e}")
        sys.exit(1)

    anyio.run(mcp.run_stdio_async)


if __name__ == "__main__":
    main()
