"""Build one clean content package from local, read-only dependency sources."""
import argparse
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def release_plan(root, version):
    """Read-only preflight; never relabel mismatched source or reuse staging."""
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Release version must be major.minor.patch')
    if tuple(map(int, version.split('.'))) < (1, 1, 0):
        raise ValueError('The accepted 1.0.0 release is immutable; use 1.1.0 or later')
    main = read(root / 'library.json')
    if [main[v] for v in ('majorVersion', 'minorVersion', 'patchVersion')] != list(map(int, version.split('.'))):
        raise ValueError('library.json version must match the requested release; no files were written')
    if read(root / 'package.json')['version'] != version:
        raise ValueError('package.json version must match the requested release; no files were written')
    if main['coreApi'] != {'majorVersion': 1, 'minorVersion': 28}:
        raise ValueError('Release requires H5P Core API 1.28')
    output = root / 'release' / version
    package = output / f'H5P.ConcordancesPapiJo-{version}.h5p'
    if output.exists():
        raise FileExistsError('Refusing to reuse release output or overwrite an existing archive: ' + str(output))
    return main, output, output / 'staging', package

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--libraries', type=Path, required=True, help='Read-only directory of installed H5P dependency libraries')
parser.add_argument('--version', default='1.1.6', help='Release version; must match source declarations (default: 1.1.6)')
args = parser.parse_args()
LIBRARIES = args.libraries.resolve()
main, OUTPUT, STAGE, PACKAGE = release_plan(ROOT, args.version)
# Exclusive creation prevents races and stale files from failed staging runs.
# Failed output is retained for inspection; it must be handled before another build.
OUTPUT.mkdir(parents=True, exist_ok=False)
STAGE.mkdir(exist_ok=False)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def key(manifest):
    return f"{manifest['machineName']}-{manifest['majorVersion']}.{manifest['minorVersion']}"

closure = {}
def collect(folder):
    manifest = read(folder / 'library.json')
    name = key(manifest)
    if name in closure:
        return
    assert not folder.is_symlink(), f'Dependency source must not be a junction: {folder}'
    closure[name] = (folder, manifest)
    for kind in ('preloadedDependencies', 'dynamicDependencies', 'editorDependencies'):
        for dependency in manifest.get(kind, []):
            collect(LIBRARIES / key(dependency))

collect(ROOT)
allowed = {'.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg',
           '.woff', '.woff2', '.ttf', '.otf', '.eot', '.txt'}
for name, (source, manifest) in closure.items():
    files = {Path('library.json')}
    for extra in ('semantics.json', 'icon.svg', 'upgrades.js'):
        if (source / extra).is_file():
            files.add(Path(extra))
    directories = {'images', 'fonts', 'language'}
    for kind in ('preloadedJs', 'preloadedCss'):
        for asset in manifest.get(kind, []):
            asset_path = Path(asset['path'])
            assert not asset_path.is_absolute() and '..' not in asset_path.parts
            assert (source / asset_path).is_file(), (name, asset)
            files.add(asset_path)
            if len(asset_path.parts) > 1:
                directories.add(asset_path.parts[0])
    for directory in directories:
        base = source / directory
        if not base.is_dir():
            continue
        for file in base.rglob('*'):
            relative = file.relative_to(source)
            if any(part.startswith('.') or part in ('node_modules', 'tests', 'src') for part in relative.parts):
                continue
            if file.is_file() and file.suffix.lower() in allowed:
                assert not file.is_symlink()
                files.add(relative)
    # Root fonts referenced by FontAwesome's CSS are distribution assets too.
    files.update(file.relative_to(source) for file in source.iterdir()
                 if file.is_file() and file.suffix.lower() in {'.woff', '.woff2', '.ttf', '.otf', '.eot', '.svg'})
    for relative in sorted(files):
        destination = STAGE / name / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / relative, destination)
    for license_name in ('LICENSE', 'LICENSE.txt', 'LICENSE.md'):
        if (source / license_name).is_file():
            shutil.copyfile(source / license_name, STAGE / name / 'LICENSE.txt')
            break

runtime = {}
def runtime_walk(manifest):
    runtime[key(manifest)] = {field: manifest[field] for field in ('machineName', 'majorVersion', 'minorVersion')}
    for kind in ('preloadedDependencies', 'dynamicDependencies'):
        for dependency in manifest.get(kind, []):
            if key(dependency) not in runtime:
                runtime_walk(closure[key(dependency)][1])
runtime_walk(main)
write(STAGE / 'h5p.json', {
    'title': f'Concordances Papi Jo {args.version} — standalone installation check',
    'language': 'en', 'mainLibrary': main['machineName'], 'embedTypes': ['iframe'],
    'preloadedDependencies': list(runtime.values())
})
write(STAGE / 'content/content.json', {'activity': {
    'title': 'Concordances Papi Jo — installation check',
    'introduction': 'Choose the shared word. Use categories to test either input format.',
    'distractors': 'perhaps\nnever', 'enableCategories': True,
    'sets': [
        {'word': 'abstract', 'category': "Teacher's ordinary KWIC", 'context':
         '[001] An ABSTRACT painting.\n[002] High-level ABSTRACTions are difficult.\n[003] Several semi-ABSTRACT painters.'},
        {'word': 'fresco', 'category': 'LancsBox X', 'context':
         'It boasts an ornate lobby, \tfrescoed \tceilings and a grand music\n'
         'amid sculptures, artwork, fountains and \tfrescoes \tand try the exquisite tasting\n'
         'by the beauty of the \tfrescoes, \ttheir colours as fresh and'}
    ]
}})

# Check every manifest edge and asset against the staged package, not the host.
for name, (_, manifest) in closure.items():
    for kind in ('preloadedDependencies', 'dynamicDependencies', 'editorDependencies'):
        assert all((STAGE / key(d) / 'library.json').is_file() for d in manifest.get(kind, []))
    for kind in ('preloadedJs', 'preloadedCss'):
        assert all((STAGE / name / asset['path']).is_file() for asset in manifest.get(kind, []))
asset_warnings = set()
known_missing_icons = {f'ui-icons_{color}_256x240.png' for color in ('444444', '555555', 'ffffff', '777620', 'cc0000', '777777')}
for css in STAGE.rglob('*.css'):
    css_text = re.sub(r'/\*.*?\*/', '', css.read_text(encoding='utf-8'), flags=re.S)
    for reference in re.findall(r'url\(\s*[\'"]?([^\)\'"\s]+)', css_text):
        if reference.startswith(('data:', 'http:', 'https:', '#')):
            continue
        target = (css.parent / re.split(r'[?#]', reference)[0]).resolve()
        assert target.is_relative_to(STAGE.resolve()), (css, reference)
        if not target.is_file():
            # Known upstream source defect: report, never invent replacement assets.
            assert css.parent.name == 'jQuery.ui-1.10' and target.name in known_missing_icons, (css, reference)
            asset_warnings.add(target.relative_to(STAGE.resolve()).as_posix())
files = sorted(file for file in STAGE.rglob('*') if file.is_file())
for file in files:
    relative = file.relative_to(STAGE)
    assert not any(part.startswith('.') or part in ('tests', 'investigation', 'node_modules', 'src', 'docs') for part in relative.parts)
    assert file.name not in ('package.json', 'package-lock.json')
    if file.suffix in ('.json', '.js', '.css', '.txt'):
        assert not re.search(r'(?i)\b[A-Z]:[\\/]', file.read_text(encoding='utf-8')), relative
assert (STAGE / key(main) / 'LICENSE.txt').read_bytes() == (ROOT / 'LICENSE').read_bytes()
with zipfile.ZipFile(PACKAGE, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.relative_to(STAGE).as_posix())
with zipfile.ZipFile(PACKAGE) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files)
write(OUTPUT / 'inventory.json', {
    'package': PACKAGE.name, 'bytes': PACKAGE.stat().st_size,
    'sha256': hashlib.sha256(PACKAGE.read_bytes()).hexdigest(),
    'libraries': [{'folder': name, 'patchVersion': manifest['patchVersion']}
                  for name, (_, manifest) in closure.items()],
    'files': [file.relative_to(STAGE).as_posix() for file in files],
    'missingUpstreamCssAssets': sorted(asset_warnings),
    'checks': ['metadata', 'manifest dependency closure', 'declared assets', 'CSS URL assets checked with six upstream warnings',
               'development exclusions', 'no Windows absolute paths', 'exact license copy', 'ZIP CRC/inventory']
})
print(json.dumps({'package': str(PACKAGE), 'files': len(files), 'libraries': len(closure),
                  'bytes': PACKAGE.stat().st_size, 'missingUpstreamCssAssets': sorted(asset_warnings)}, indent=2))
