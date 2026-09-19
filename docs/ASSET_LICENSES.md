# DEADGRID asset license audit

Audit updated: 2026-09-19.

All GLBs used by the game under `public/assets/runtime/` are included in the public repository. The raw `public/assets/incoming/` intake folder is excluded because it contains duplicate, oversized, and unused material; excluding it does not remove or disable any implemented runtime model.

The redistribution record for shipped files is maintained in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). That file is authoritative for public releases.

## Published runtime assets

| Asset group | License evidence | Release status |
| --- | --- | --- |
| Generator, tower, vehicles, character, and weapon GLBs | Creator, source URL, and CC BY 4.0 license embedded in each GLB's `asset.extras` metadata | Included with attribution |
| Military outpost GLB | Embedded creator/source metadata identifies CC BY 4.0; title also states CC0 | Included under the more conservative CC BY 4.0 terms |
| Kenney Impact Sounds | `License.txt` in source archive states CC0 1.0 | Included |
| Kenney Input Prompts | `License.txt` in source archive states CC0 1.0 | Included |

## Excluded source material

The following local intake material is not part of the public repository or build because the game does not use it:

- raw `.blend.zip`, `.exr`, and OBJ archives;
- duplicate and high-resolution GLB downloads;
- the Ford Mustang and desert assassin models;
- the unused horror hit sound pack;
- any other incoming file not explicitly listed in `THIRD_PARTY_NOTICES.md`.

Do not move an excluded file into the runtime tree unless its redistribution rights have been verified and its exact attribution has been added to `THIRD_PARTY_NOTICES.md`.

