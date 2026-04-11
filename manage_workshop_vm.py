import sys
import os
import json

sys.path.append(os.path.join(os.getcwd(), "src"))

try:
    from proxmox_mcp.core.proxmox import ProxmoxManager
    from proxmox_mcp.config.loader import load_config
except ImportError:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(os.path.join(script_dir, "src"))
    from proxmox_mcp.core.proxmox import ProxmoxManager
    from proxmox_mcp.config.loader import load_config

def main():
    config_path = "proxmox-config/config.json"
    if not os.path.exists(config_path):
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), config_path)
    config = load_config(config_path)
    manager = ProxmoxManager(config.proxmox, config.auth)
    api = manager.get_api()
    node = "pve"
    print("Checking VM 104 (Workshop)...")
    try:
        vm104 = api.nodes(node).qemu(104).status.current.get()
        print("VM 104 status: {}".format(vm104.get("status")))
        conf104 = api.nodes(node).qemu(104).config.get()
        print("VM 104 HostPCI: {}".format(conf104.get("hostpci0")))
        if vm104.get("status") != "running":
            print("Starting VM 104...")
            api.nodes(node).qemu(104).status.start.post()
            print("Start command sent.")
    except Exception as e:
        print("Error checking VM 104: {}".format(e))
    print("\nChecking VM 400 (hugh-canvas)...")
    try:
        vm400 = api.nodes(node).qemu(400).status.current.get()
        print("VM 400 status: {}".format(vm400.get("status")))
        if vm400.get("status") == "running":
            print("Stopping VM 400 to release GPU...")
            api.nodes(node).qemu(400).status.stop.post()
            print("Stop command sent.")
    except Exception as e:
        print("Error checking VM 400: {}".format(e))

if __name__ == "__main__":
    main()
