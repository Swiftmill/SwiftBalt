import sys
import os

# Ensure current working directory / project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import click
import requests
import asyncio
from backend.providers.registry import provider_registry

API_URL = "http://127.0.0.1:8000/api"

@click.group()
def cli():
    """SwiftBalt CLI - Universal Media Downloader & Platform Utility"""
    pass

@cli.command()
@click.argument('url')
def analyze(url):
    """Analyse une URL et affiche les métadonnées et formats disponibles."""
    click.echo(f"🔍 Analyse de l'URL: {url}...")
    try:
        provider = provider_registry.find_provider_for_url(url)
        if not provider:
            click.echo("❌ Aucun provider correspondant.", err=True)
            return

        loop = asyncio.get_event_loop()
        metadata = loop.run_until_complete(provider.get_metadata(url))

        click.echo("\n✅ --- MÉTADONNÉES REÇUES ---")
        click.echo(f"📌 Titre : {metadata.title}")
        click.echo(f"👤 Auteur : {metadata.author or 'Inconnu'}")
        click.echo(f"🌐 Provider : {metadata.provider_name}")
        click.echo(f"⏱️ Durée : {metadata.duration or 'N/A'} secondes")
        click.echo(f"🎥 Formats disponibles : {len(metadata.available_formats)}")
    except Exception as e:
        click.echo(f"❌ Erreur d'analyse : {e}", err=True)

@cli.command()
@click.argument('url')
@click.option('--format', '-f', 'target_format', default='mp4', help='Format de sortie (mp4, mp3, webm, etc.)')
def download(url, target_format):
    """Lance un téléchargement via l'API SwiftBalt."""
    click.echo(f"⬇️ Envoi de la demande de téléchargement pour {url} ({target_format})...")
    try:
        provider = provider_registry.find_provider_for_url(url)
        loop = asyncio.get_event_loop()
        metadata = loop.run_until_complete(provider.get_metadata(url))

        resp = requests.post(f"{API_URL}/download", json={
            "url": url,
            "provider_id": provider.id,
            "title": metadata.title,
            "thumbnail_url": metadata.thumbnail,
            "target_format": target_format,
            "audio_only": target_format in ['mp3', 'm4a', 'wav', 'flac']
        })

        if resp.status_code == 200:
            data = resp.json()
            click.echo(f"🎉 Téléchargement ajouté à la file d'attente ! ID Tâche: {data['task_id']}")
        else:
            click.echo(f"❌ Erreur du serveur API : {resp.text}", err=True)
    except Exception as e:
        click.echo(f"❌ Erreur : {e}", err=True)

@cli.command()
@click.argument('magnet')
def torrent(magnet):
    """Ajoute un lien magnet au Torrent Center de SwiftBalt."""
    click.echo(f"🧲 Ajout du torrent magnet...")
    try:
        resp = requests.post(f"{API_URL}/torrent", json={"source": magnet})
        if resp.status_code == 200:
            click.echo(f"✅ Torrent ajouté avec succès ! ID: {resp.json()['torrent_id']}")
        else:
            click.echo(f"❌ Erreur : {resp.text}", err=True)
    except Exception as e:
        click.echo(f"❌ Erreur : {e}", err=True)

@cli.command()
def history():
    """Affiche l'historique des téléchargements SwiftBalt."""
    try:
        resp = requests.get(f"{API_URL}/history")
        if resp.status_code == 200:
            items = resp.json().get('history', [])
            click.echo(f"\n📜 --- HISTORIQUE SWIFTBALT ({len(items)}) ---")
            for item in items:
                click.echo(f"• [{item.get('target_format', 'mp4').upper()}] {item.get('title')} ({item.get('provider_id')})")
        else:
            click.echo(f"❌ Erreur : {resp.text}", err=True)
    except Exception as e:
        click.echo(f"❌ Erreur : {e}", err=True)

@cli.command()
def providers():
    """Affiche la liste de tous les providers supportés par SwiftBalt."""
    click.echo("\n🌐 --- PROVIDERS SUPPORTÉS PAR SWIFTBALT ---")
    for p in provider_registry.list_providers():
        click.echo(f"• {p['name']} ({p['id']}) - Domaines: {', '.join(p['domains']) if p['domains'] else 'Direct/Torrent'}")

if __name__ == '__main__':
    cli()
