import urllib.request
import zipfile
import os

url = "https://github.com/cli/cli/releases/download/v2.91.0/gh_2.91.0_windows_amd64.zip"
urllib.request.urlretrieve(url, "gh.zip")
print("Downloaded")

with zipfile.ZipFile("gh.zip", "r") as zip_ref:
    zip_ref.extractall(".")
print("Extracted")

os.rename("gh_2.91.0_windows_amd64\\bin\\gh.exe", "gh.exe")
print("Done - gh.exe ready")