-- Replace the retired Dino Family / POC species ids with the nine live
-- elemental creature ids used by the application.

alter table public.pets
  drop constraint if exists pets_species_check;

update public.pets
set
  species = case species
    when 'blaze-crest' then 'fire'
    when 'ember-sail' then 'fire'
    when 'garden' then 'grass'
    when 'crag-shell' then 'ground'
    when 'tide-fin' then 'water'
    when 'volt-wing' then 'electric'
    when 'fire' then 'fire'
    when 'grass' then 'grass'
    when 'ground' then 'ground'
    when 'electric' then 'electric'
    when 'water' then 'water'
    when 'ice' then 'ice'
    when 'dragon' then 'dragon'
    when 'dark' then 'dark'
    else 'neutral'
  end,
  element_primary = case species
    when 'blaze-crest' then 'fire'
    when 'ember-sail' then 'fire'
    when 'garden' then 'grass'
    when 'crag-shell' then 'ground'
    when 'tide-fin' then 'water'
    when 'volt-wing' then 'electric'
    when 'fire' then 'fire'
    when 'grass' then 'grass'
    when 'ground' then 'ground'
    when 'electric' then 'electric'
    when 'water' then 'water'
    when 'ice' then 'ice'
    when 'dragon' then 'dragon'
    when 'dark' then 'dark'
    else 'neutral'
  end,
  element_secondary = null;

alter table public.pets
  add constraint pets_species_check check (
    species in (
      'neutral',
      'fire',
      'grass',
      'ground',
      'electric',
      'water',
      'ice',
      'dragon',
      'dark'
    )
  );
