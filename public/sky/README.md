# Northern sky

`hyg-stars.png` is a 4096 × 2048 equirectangular rendering of HYG v4.1 stars with apparent visual magnitude ≤ 6.5, excluding the Sun. Positions use J2000 right ascension and declination. Star sizes and brightness are compressed for legibility in the scene. The aurora is an artistic animated overlay, not an observation or forecast.

Source: [HYG Star Database v4.1](https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v41.csv), David Nash / Astronexus. The source catalog and this derived map are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Regenerate after downloading `hygdata_v41.csv`:

```sh
node scripts/bake-star-map.mjs /path/to/hygdata_v41.csv
```
