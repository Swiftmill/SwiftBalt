# Guide : Ajouter un nouveau Provider dans SwiftBalt

SwiftBalt utilise une architecture modulaire et extensible pour gérer les différents services et plateformes de médias.

## Structure d'un Provider

Chaque provider hérite de la classe de base `BaseProvider` située dans `backend/providers/base.py`.

```python
from backend.providers.base import BaseProvider, MediaMetadata, FormatOption

class CustomProvider(BaseProvider):
    id = "mon_service"
    name = "Mon Service"
    domains = ["monservice.com", "ms.co"]
    icon = "video"
    capabilities = ["metadata", "download", "preview"]

    def detect(self, url: str) -> bool:
        return any(domain in url.lower() for domain in self.domains)

    async def get_metadata(self, url: str) -> MediaMetadata:
        # Extraire les informations et les formats disponibles
        return MediaMetadata(
            id="12345",
            title="Titre du contenu",
            author="Auteur",
            provider_id=self.id,
            provider_name=self.name,
            source_url=url,
            available_formats=[...]
        )
```

## Enregistrement du Provider

Pour ajouter votre nouveau provider au registre global :

1. Déclarez votre classe dans `backend/providers/` (ex: `custom_provider.py`).
2. Ajoutez votre instance dans `backend/providers/registry.py` dans la méthode `_load_providers()`.

```python
from backend.providers.custom_provider import CustomProvider

# Dans ProviderRegistry._load_providers():
self.providers.append(CustomProvider())
```

## Bonnes Pratiques & Sécurité

1. **Validation d'URL** : Utilisez la fonction `is_safe_url(url)` de `backend.security` pour prévenir les attaques SSRF.
2. **Gestion des erreurs** : Retournez des erreurs compréhensibles en français sans exposer de stack traces sensibles.
3. **Absence de DRM** : Ne tentez jamais de contourner un DRM, un paywall ou un contenu privé.
