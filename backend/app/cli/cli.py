import typer
import asyncio
from rich.console import Console
from rich.table import Table
from app.providers.registry import registry
from app.core.security import validate_url_security
from app.downloads.engine import DownloadEngine
from app.core.config import settings
from app.torrents.manager import torrent_manager
from app.database.session import init_db, async_session_factory
from app.database import crud

app = typer.Typer(help="SwiftBalt (MediaHub) CLI - The OmniDownloader Command Line Interface")
console = Console()


@app.command()
def analyze(url: str):
    """Analyze any media or file URL and inspect metadata and formats."""
    async def _run():
        await init_db()
        with console.status("[bold green]Analyse de l'URL...[/bold green]"):
            validated = validate_url_security(url)
            provider = registry.detect_provider(validated)
            if not provider:
                console.print(f"[red]Erreur : Aucun provider disponible pour '{url}'.[/red]")
                return

            meta = await provider.get_metadata(validated)

        console.print(f"\n[bold cyan]=== SwiftBalt URL Inspector ===[/bold cyan]")
        console.print(f"[bold]Titre :[/bold] {meta.get('title')}")
        console.print(f"[bold]Plateforme :[/bold] {meta.get('platform')}")
        console.print(f"[bold]Auteur :[/bold] {meta.get('author')}")
        console.print(f"[bold]Durée :[/bold] {meta.get('duration')} secondes")
        console.print(f"[bold]Description :[/bold] {meta.get('description')[:120]}...")

    asyncio.run(_run())


@app.command()
def download(
    url: str,
    format: str = typer.Option("mp4", "--format", "-f", help="Format de sortie (mp4, webm, mp3, etc.)"),
    quality: str = typer.Option("1080p", "--quality", "-q", help="Qualité cible (1080p, 720p, etc.)")
):
    """Download media directly from the command line."""
    async def _run():
        await init_db()
        console.print(f"[yellow]Démarrage du téléchargement : {url}[/yellow]")
        validated = validate_url_security(url)
        provider = registry.detect_provider(validated)
        meta = await provider.get_metadata(validated)
        title = meta.get("title", "download")

        def _prog(d):
            pct = d.get("progress", 0)
            spd = d.get("speed", 0) / (1024 * 1024)
            console.print(f"Progression : {pct}% | Vitesse : {spd:.2f} Mo/s", end="\r")

        res_path = await DownloadEngine.download_media(
            url=validated,
            output_dir=settings.DOWNLOADS_PATH,
            title=title,
            target_format=format,
            target_quality=quality,
            progress_callback=_prog
        )
        console.print(f"\n[bold green]Téléchargement terminé : {res_path}[/bold green]")

    asyncio.run(_run())


@app.command()
def providers():
    """List all supported providers and their operational status."""
    table = Table(title="SwiftBalt Supported Providers")
    table.add_column("ID", style="cyan")
    table.add_column("Nom", style="bold")
    table.add_column("Statut", style="green")
    table.add_column("Domaines", style="magenta")

    for p in registry.get_all_providers_status():
        doms = ", ".join(p["domains"][:2]) + ("..." if len(p["domains"]) > 2 else "")
        table.add_row(p["id"], p["name"], p["status"], doms)

    console.print(table)


@app.command()
def torrent(magnet_uri: str):
    """Start legal torrent download from magnet link."""
    async def _run():
        await init_db()
        res = await torrent_manager.add_magnet(magnet_uri)
        console.print(f"[bold green]Torrent ajouté : {res['name']}[/bold green]")
        console.print(f"ID : {res['id']} | Statut : {res['status']}")

    asyncio.run(_run())


@app.command()
def history():
    """Display download history."""
    async def _run():
        await init_db()
        async with async_session_factory() as db:
            items = await crud.list_history(db, limit=20)

        table = Table(title="Historique des Téléchargements")
        table.add_column("Date", style="dim")
        table.add_column("Titre", style="bold")
        table.add_column("Plateforme", style="cyan")
        table.add_column("Format", style="magenta")

        for i in items:
            dt = i.created_at.strftime("%Y-%m-%d %H:%M") if i.created_at else "N/A"
            table.add_row(dt, i.title[:40], i.platform, i.format)

        console.print(table)

    asyncio.run(_run())


if __name__ == "__main__":
    app()
