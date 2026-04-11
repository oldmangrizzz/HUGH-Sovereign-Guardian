#!/usr/bin/env python3
"""
Create Windows VM for VR gaming
"""
import os
import sys

def create_windows_vm():
    """Create Windows VM suitable for VR gaming"""
    
    # Set configuration
    os.environ['PROXMOX_MCP_CONFIG'] = 'proxmox-config/config.json'
    
    try:
        from proxmox_mcp.config.loader import load_config
        from proxmox_mcp.core.proxmox import ProxmoxManager
        from proxmox_mcp.tools.vm import VMTools
        
        config = load_config('proxmox-config/config.json')
        manager = ProxmoxManager(config.proxmox, config.auth)
        api = manager.get_api()
        
        vm_tools = VMTools(api)
        
        print("🎮 Creating Windows VM for VR gaming")
        print("=" * 50)
        print("Configuration:")
        print("  • CPU: 4 cores")
        print("  • RAM: 8 GB (8192 MB)")
        print("  • Storage: 60 GB")
        print("  • OS: Windows 10/11 (will need ISO installation)")
        print()
        
        # Find an available VM ID (start from 200 to avoid conflicts with test VMs)
        vmid = "200"
        
        # Check if VM ID already exists
        try:
            existing_vm = api.nodes("pve").qemu(vmid).config.get()
            print(f"⚠️ VM {vmid} already exists, incrementing...")
            # Try to find next available ID
            for i in range(200, 300):
                test_vmid = str(i)
                try:
                    api.nodes("pve").qemu(test_vmid).config.get()
                except:
                    vmid = test_vmid
                    print(f"✅ Found available VM ID: {vmid}")
                    break
            else:
                print("❌ Could not find available VM ID in range 200-299")
                return False
        except:
            print(f"✅ VM ID {vmid} is available")
        
        # Create Windows VM
        result = vm_tools.create_vm(
            node="pve",
            vmid=vmid,
            name="windows-vr-gaming",
            cpus=4,
            memory=8192,  # 8GB in MB
            disk_size=60  # 60GB
        )
        
        for content in result:
            print(content.text)
            
        print("\n📋 Next steps for Windows installation:")
        print("1. Upload a Windows ISO to the Proxmox node")
        print("2. Attach the ISO to the VM as a CD/DVD drive")
        print("3. Start the VM and proceed with Windows installation")
        print("4. Install VirtIO drivers for better performance")
        print("5. Configure GPU passthrough if available for VR performance")
        
        return True
        
    except Exception as e:
        print(f"❌ Creation failed: {e}")
        return False

if __name__ == "__main__":
    print("🎮 Create Windows VM for VR gaming")
    print("=" * 40)
    
    success = create_windows_vm()
    
    if success:
        print("\n✅ Windows VM creation completed")
    else:
        print("\n❌ Windows VM creation failed")
        sys.exit(1)
