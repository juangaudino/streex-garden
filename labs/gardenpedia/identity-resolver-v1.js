(() => {
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  function search(query, plants) {
    const needle = normalize(query);
    if (!needle) return [];
    const matches = [];
    for (const plant of plants || []) {
      const values = [plant.id, plant.name, plant.spanishName, plant.commonName,
        plant.scientificName, plant.cultivar, plant.variety, ...(plant.aliases || []), ...(plant.tags || [])]
        .map(normalize).filter(Boolean);
      let rank = -1;
      if (values.some((value) => value === needle)) rank = 0;
      else if (values.some((value) => value.startsWith(needle))) rank = 1;
      else if (values.some((value) => value.includes(needle))) rank = 2;
      if (rank >= 0) matches.push({ plant, rank });
    }
    return matches.sort((a, b) => a.rank - b.rank ||
      String(a.plant.name || a.plant.id).localeCompare(String(b.plant.name || b.plant.id)))
      .map(({ plant }) => plant);
  }

  function exactMatch(query, plants) {
    const needle = normalize(query);
    if (!needle) return false;
    return (plants || []).some((plant) => [plant.id, plant.name, plant.spanishName, plant.commonName,
      plant.scientificName, plant.cultivar, plant.variety, ...(plant.aliases || [])]
      .some((value) => normalize(value) === needle));
  }

  function describe(plant) {
    return {
      displayName: plant?.name || plant?.commonName || plant?.id || "",
      species: plant?.scientificName || "",
      cultivar: plant?.cultivar || plant?.variety || "",
      aliases: Array.isArray(plant?.aliases) ? plant.aliases : [],
    };
  }

  window.GardenpediaIdentityResolver = Object.freeze({ normalize, search, exactMatch, describe });
})();
