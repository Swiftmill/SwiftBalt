from setuptools import setup, find_packages

setup(
    name="swiftbalt",
    version="1.0.0",
    description="SwiftBalt Universal Media Downloader & Platform Utility",
    py_modules=["cli"],
    packages=find_packages(),
    install_requires=[
        "click",
        "requests",
        "fastapi",
        "uvicorn",
        "yt-dlp",
    ],
    entry_points={
        "console_scripts": [
            "swiftbalt=cli:cli",
            "mediahub=cli:cli",
        ],
    },
)
