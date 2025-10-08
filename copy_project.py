#!/usr/bin/env python3
"""
Project Copy Script for TSQL.APP React Client
Copies the entire project to a new destination including .claude environment
Can optionally create a ZIP file instead of copying to a directory
"""

import os
import shutil
import sys
import zipfile
from pathlib import Path

def get_output_mode():
    """Get output mode from user input"""
    while True:
        print("\nChoose output mode:")
        print("1. Copy to directory (default)")
        print("2. Create ZIP file")
        choice = input("Enter choice (1 or 2): ").strip()
        
        if not choice or choice == '1':
            return 'directory'
        elif choice == '2':
            return 'zip'
        else:
            print("Please enter 1 or 2.")

def get_destination_path(output_mode):
    """Get destination path from user input"""
    while True:
        if output_mode == 'zip':
            dest_input = input("\nEnter ZIP file path (e.g., D:\\backups\\my-project.zip): ").strip()
            if dest_input and not dest_input.lower().endswith('.zip'):
                dest_input += '.zip'
        else:
            dest_input = input("\nEnter destination path (e.g., D:\\projects\\my-new-project): ").strip()
        
        if not dest_input:
            print("Please enter a valid path.")
            continue
            
        dest_path = Path(dest_input)
        
        # Check if parent directory exists
        if not dest_path.parent.exists():
            print(f"Parent directory '{dest_path.parent}' does not exist.")
            create_parent = input("Create parent directories? (y/n): ").lower()
            if create_parent == 'y':
                try:
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    print(f"Created parent directories: {dest_path.parent}")
                except Exception as e:
                    print(f"Error creating parent directories: {e}")
                    continue
            else:
                continue
        
        # Check if destination already exists
        if dest_path.exists():
            print(f"Destination '{dest_path}' already exists.")
            overwrite = input("Overwrite? (y/n): ").lower()
            if overwrite != 'y':
                continue
            else:
                try:
                    if dest_path.is_dir():
                        shutil.rmtree(dest_path)
                    else:
                        dest_path.unlink()
                except Exception as e:
                    print(f"Error removing existing destination: {e}")
                    continue
        
        return dest_path

def get_project_info(source_path):
    """Display project information"""
    print(f"\n{'='*60}")
    print("PROJECT COPY - TSQL.APP React Client")
    print(f"{'='*60}")
    print(f"Source: {source_path}")
    
    # Count files and directories
    total_files = 0
    total_dirs = 0
    total_size = 0
    
    for root, dirs, files in os.walk(source_path):
        total_dirs += len(dirs)
        for file in files:
            total_files += 1
            try:
                file_path = Path(root) / file
                total_size += file_path.stat().st_size
            except (OSError, FileNotFoundError):
                pass  # Skip files that can't be accessed
    
    print(f"Total files: {total_files}")
    print(f"Total directories: {total_dirs}")
    print(f"Total size: {total_size / (1024*1024):.1f} MB")
    print(f"{'='*60}")

def should_exclude_path(path_str):
    """Check if a path should be excluded from copying"""
    exclude_patterns = [
        'node_modules',
        '.git',
        'build',
        'buildmin_new',
        '__pycache__',
        '.pyc',
        '.DS_Store',
        'Thumbs.db',
        '.vscode/settings.json',  # Exclude user-specific settings
        'npm-debug.log',
        'yarn-error.log'
    ]
    
    path_lower = path_str.lower()
    for pattern in exclude_patterns:
        if pattern in path_lower:
            return True
    return False

def copy_with_progress(src, dst):
    """Copy files with progress indication"""
    copied_files = 0
    skipped_files = 0
    errors = []
    
    print(f"\nCopying from: {src}")
    print(f"Copying to:   {dst}")
    print("-" * 60)
    
    for root, dirs, files in os.walk(src):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if not should_exclude_path(d)]
        
        src_root = Path(root)
        rel_path = src_root.relative_to(src)
        dst_root = dst / rel_path
        
        # Create destination directory
        try:
            dst_root.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            errors.append(f"Error creating directory {dst_root}: {e}")
            continue
        
        # Copy files
        for file in files:
            src_file = src_root / file
            dst_file = dst_root / file
            
            # Skip excluded files
            if should_exclude_path(str(src_file)):
                skipped_files += 1
                continue
            
            try:
                shutil.copy2(src_file, dst_file)
                copied_files += 1
                
                # Progress indication
                if copied_files % 50 == 0:
                    print(f"Copied {copied_files} files...")
                    
            except Exception as e:
                errors.append(f"Error copying {src_file}: {e}")
                continue
    
    return copied_files, skipped_files, errors

def create_zip_with_progress(src, dst):
    """Create ZIP file with progress indication"""
    copied_files = 0
    skipped_files = 0
    errors = []
    
    print(f"\nCreating ZIP file from: {src}")
    print(f"ZIP file path:          {dst}")
    print("-" * 60)
    
    try:
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zipf:
            for root, dirs, files in os.walk(src):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if not should_exclude_path(d)]
                
                src_root = Path(root)
                
                # Add files to ZIP
                for file in files:
                    src_file = src_root / file
                    
                    # Skip excluded files
                    if should_exclude_path(str(src_file)):
                        skipped_files += 1
                        continue
                    
                    try:
                        # Calculate relative path for ZIP
                        rel_path = src_file.relative_to(src)
                        zipf.write(src_file, rel_path)
                        copied_files += 1
                        
                        # Progress indication
                        if copied_files % 50 == 0:
                            print(f"Added {copied_files} files to ZIP...")
                            
                    except Exception as e:
                        errors.append(f"Error adding {src_file} to ZIP: {e}")
                        continue
                        
    except Exception as e:
        errors.append(f"Error creating ZIP file: {e}")
    
    return copied_files, skipped_files, errors

def update_package_json_in_zip(zip_path):
    """Update package.json with new project name inside ZIP file if it exists"""
    try:
        import json
        import tempfile
        
        # Read the ZIP file
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            # Check if package.json exists in ZIP
            if 'package.json' not in zipf.namelist():
                return
            
            # Read package.json from ZIP
            with zipf.open('package.json') as f:
                package_data = json.load(f)
        
        # Update name to ZIP file name (without extension)
        zip_name = Path(zip_path).stem
        new_name = zip_name.lower().replace(' ', '-')
        old_name = package_data.get('name', 'unknown')
        package_data['name'] = new_name
        
        # Create temporary file with updated package.json
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(package_data, temp_file, indent=2, ensure_ascii=False)
            temp_path = temp_file.name
        
        # Update the ZIP file
        with zipfile.ZipFile(zip_path, 'a') as zipf:
            # Remove old package.json
            zipf_temp = zipfile.ZipFile(zip_path + '.tmp', 'w')
            for item in zipf.infolist():
                if item.filename != 'package.json':
                    data = zipf.read(item.filename)
                    zipf_temp.writestr(item, data)
            zipf_temp.close()
        
        # Replace original with temp
        os.replace(zip_path + '.tmp', zip_path)
        
        # Add updated package.json
        with zipfile.ZipFile(zip_path, 'a') as zipf:
            zipf.write(temp_path, 'package.json')
        
        # Clean up temp file
        os.unlink(temp_path)
        
        print(f"Updated package.json name in ZIP: '{old_name}' -> '{new_name}'")
        
    except Exception as e:
        print(f"Warning: Could not update package.json in ZIP: {e}")

def update_package_json(dest_path):
    """Update package.json with new project name if it exists"""
    package_json_path = dest_path / "package.json"
    
    if not package_json_path.exists():
        return
    
    try:
        import json
        
        # Read current package.json
        with open(package_json_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        # Update name to destination folder name
        new_name = dest_path.name.lower().replace(' ', '-')
        old_name = package_data.get('name', 'unknown')
        package_data['name'] = new_name
        
        # Write updated package.json
        with open(package_json_path, 'w', encoding='utf-8') as f:
            json.dump(package_data, f, indent=2, ensure_ascii=False)
        
        print(f"Updated package.json name: '{old_name}' -> '{new_name}'")
        
    except Exception as e:
        print(f"Warning: Could not update package.json: {e}")

def main():
    """Main function"""
    # Get current directory as source
    source_path = Path.cwd()
    
    # Verify this is a React project
    if not (source_path / "package.json").exists():
        print("Error: This doesn't appear to be a Node.js/React project (no package.json found)")
        sys.exit(1)
    
    # Display project info
    get_project_info(source_path)
    
    # Get output mode
    output_mode = get_output_mode()
    
    # Get destination
    dest_path = get_destination_path(output_mode)
    
    if output_mode == 'zip':
        print(f"\nReady to create ZIP file:")
        print(f"From: {source_path}")
        print(f"To:   {dest_path}")
        action_word = "ZIP creation"
        proceed_text = "Proceed with ZIP creation? (y/n): "
    else:
        print(f"\nReady to copy project:")
        print(f"From: {source_path}")
        print(f"To:   {dest_path}")
        action_word = "copy"
        proceed_text = "Proceed with copy? (y/n): "
    
    confirm = input(f"\n{proceed_text}").lower()
    if confirm != 'y':
        print(f"{action_word.capitalize()} cancelled.")
        sys.exit(0)
    
    # Perform the operation
    try:
        if output_mode == 'zip':
            copied_files, skipped_files, errors = create_zip_with_progress(source_path, dest_path)
            operation_name = "ZIP CREATION COMPLETED"
            result_label = "Files added to ZIP"
        else:
            copied_files, skipped_files, errors = copy_with_progress(source_path, dest_path)
            operation_name = "COPY COMPLETED"
            result_label = "Files copied"
        
        print(f"\n{'='*60}")
        print(operation_name)
        print(f"{'='*60}")
        print(f"{result_label}: {copied_files}")
        print(f"Files skipped: {skipped_files}")
        print(f"Destination: {dest_path}")
        
        if errors:
            print(f"\nWarnings/Errors ({len(errors)}):")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")
        
        # Update package.json
        if output_mode == 'zip':
            update_package_json_in_zip(dest_path)
        else:
            update_package_json(dest_path)
        
        print(f"\n{'='*60}")
        print("NEXT STEPS:")
        print(f"{'='*60}")
        
        if output_mode == 'zip':
            print(f"1. Extract the ZIP file: {dest_path}")
            print("2. cd to extracted directory")
            print("3. npm install")
            print("4. npm run start")
        else:
            print(f"1. cd \"{dest_path}\"")
            print("2. npm install")
            print("3. npm run start")
        
        print(f"{'='*60}")
        
        # Check for important files
        if output_mode == 'zip':
            # Check inside ZIP file
            try:
                with zipfile.ZipFile(dest_path, 'r') as zipf:
                    zip_contents = zipf.namelist()
                    important_files = ['.claude/', 'CLAUDE.md', 'package.json', 'src/App.js']
                    missing_files = []
                    
                    for file in important_files:
                        # Check for directory or file
                        if not any(item.startswith(file) for item in zip_contents):
                            missing_files.append(file)
                    
                    if missing_files:
                        print(f"\nWarning: Some important files/directories were not added to ZIP:")
                        for file in missing_files:
                            print(f"  - {file}")
                    else:
                        print(f"\n✓ All important files added to ZIP successfully (including .claude environment)")
            except Exception as e:
                print(f"\nWarning: Could not verify ZIP contents: {e}")
        else:
            # Check in destination directory
            important_files = ['.claude', 'CLAUDE.md', 'package.json', 'src/App.js']
            missing_files = []
            
            for file in important_files:
                if not (dest_path / file).exists():
                    missing_files.append(file)
            
            if missing_files:
                print(f"\nWarning: Some important files/directories were not copied:")
                for file in missing_files:
                    print(f"  - {file}")
            else:
                print(f"\n✓ All important files copied successfully (including .claude environment)")
        
    except KeyboardInterrupt:
        print(f"\n\n{action_word.capitalize()} interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during {action_word}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()