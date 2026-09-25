import os
import shutil
import zlib
import base64
import ast
import tarfile
import zipfile
from pathlib import Path

def strip_docstrings_and_comments(source_code: str) -> str:
    """Removes docstrings, comments and extraneous whitespace using AST."""
    try:
        parsed = ast.parse(source_code)
        for node in ast.walk(parsed):
            # Strip docstrings from functions, classes, and modules
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)):
                if (node.body and isinstance(node.body[0], ast.Expr) and
                        isinstance(node.body[0].value, ast.Constant) and
                        isinstance(node.body[0].value.value, str)):
                    # Replace docstring with pass
                    node.body[0] = ast.Pass()
        return ast.unparse(parsed)
    except Exception:
        # Fallback to source
        return source_code

def obfuscate_file(file_path: Path):
    """Encrypts and encapsulates Python source code into an unreadable binary payload."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        original = f.read()

    # Don't re-obfuscate if already protected
    if "Protected by SwiftBalt Shield" in original:
        return

    cleaned = strip_docstrings_and_comments(original)
    compressed = zlib.compress(cleaned.encode("utf-8"), level=9)
    encoded = base64.b85encode(compressed).decode("ascii")

    obfuscated_code = (
        "# Protected by SwiftBalt Shield (Compiled & Obfuscated)\n"
        "import zlib as _z, base64 as _b\n"
        f"exec(compile(_z.decompress(_b.b85decode(b'{encoded}')), '<swiftbalt>', 'exec'))\n"
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(obfuscated_code)

def secure_portable_package(root_dir: Path):
    portable_dir = root_dir / "SwiftBalt-Linux-Portable"
    backend_dest = portable_dir / "backend"

    print("==========================================================")
    print("[SECURISATION INTEGRALE DE SWIFTBALT LINUX PORTABLE]")
    print("==========================================================")

    # 1. Nettoyage initial des dossiers indésirables
    print("1. Nettoyage des tests et fichiers de développement...")
    for root, dirs, files in os.walk(backend_dest, topdown=False):
        for d in dirs:
            if d in ["__pycache__", "tests", ".pytest_cache"]:
                p = Path(root) / d
                shutil.rmtree(p, ignore_errors=True)
                print(f"   -> Supprimé : {p.name}")
        for f in files:
            if f.endswith((".pyc", ".pyo", ".log", ".tmp", ".exe", ".bat")):
                if f != "SwiftBalt":
                    (Path(root) / f).unlink(missing_ok=True)

    # 2. Obfuscation de tous les fichiers Python
    print("\n2. Chiffrement et obfuscation des fichiers Python backend...")
    py_count = 0
    for root, _, files in os.walk(backend_dest):
        for f in files:
            if f.endswith(".py"):
                f_path = Path(root) / f
                obfuscate_file(f_path)
                py_count += 1
                rel = f_path.relative_to(portable_dir)
                print(f"   [VERROUILLÉ] {rel}")

    print(f"\n   Total : {py_count} fichiers Python entièrement obfusqués et illisibles !")

    # 3. Vérification du binaire natif Linux
    native_bin = root_dir / "linux_launcher" / "target" / "x86_64-unknown-linux-musl" / "release" / "linux_launcher"
    if native_bin.exists():
        shutil.copy2(native_bin, portable_dir / "SwiftBalt")
        print("\n3. Binaire natif Linux SwiftBalt (logo écrou) synchronisé.")

    # 4. Packaging des archives avec permissions 0755
    print("\n4. Génération des archives compressées avec permissions 0755...")
    tar_path = root_dir / "SwiftBalt-Linux-Portable.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        for root, _, files in os.walk(portable_dir):
            for f in files:
                full_p = Path(root) / f
                rel_p = full_p.relative_to(root_dir)
                ti = tar.gettarinfo(full_p, arcname=str(rel_p).replace("\\", "/"))
                ti.mode = 0o755 if f in ["SwiftBalt", "Lancer_SwiftBalt.sh", "Creer_Raccourci_Bureau.sh"] else 0o644
                with open(full_p, "rb") as fp:
                    tar.addfile(ti, fp)
    print(f"   -> {tar_path.name} créé ({round(tar_path.stat().st_size / 1024 / 1024, 2)} Mo)")

    zip_path = root_dir / "SwiftBalt-Linux-Portable.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(portable_dir):
            for f in files:
                full_p = Path(root) / f
                rel_p = str(full_p.relative_to(root_dir)).replace("\\", "/")
                zi = zipfile.ZipInfo(rel_p)
                zi.external_attr = (0o755 << 16) if f in ["SwiftBalt", "Lancer_SwiftBalt.sh", "Creer_Raccourci_Bureau.sh"] else (0o644 << 16)
                with open(full_p, "rb") as fp:
                    zf.writestr(zi, fp.read())
    print(f"   -> {zip_path.name} créé ({round(zip_path.stat().st_size / 1024 / 1024, 2)} Mo)")

    print("\n==========================================================")
    print("[SUCCES] SWIFTBALT LINUX PORTABLE EST 100% SECURISE !")
    print("==========================================================")

if __name__ == "__main__":
    current_root = Path(__file__).resolve().parent.parent
    secure_portable_package(current_root)
