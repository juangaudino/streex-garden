# Plant Profile completion rubric — 2026-10-17

This rubric is the editorial gate for the 501 public Plant identities. It is
intended to reduce repeated research while preventing structural coverage from
being mistaken for a complete, useful profile.

## Editorial outcomes

- **Complete** — identity is resolved; the established plant has useful,
  evidence-backed cultivation and management guidance; harvest/use is covered
  where relevant; material normal-vs-problem signals are represented where
  evidence supports them; EN and ES are semantically complete; all source
  references resolve and their taxonomic/product scope matches the claims; and
  the Plant/Seed/private-inventory boundary is correct. Required but genuinely
  inapplicable topics are explicitly treated as not applicable, not silently
  filled with guesses. No material unresolved `needs_validation` item remains.
- **Partial** — identity is publishable, but one or more useful, applicable
  editorial areas, evidence checks, translations, or record-level QA remain.
- **Pending** — identity/taxonomy or a material evidence conflict prevents a
  defensible profile decision, or individual review has not yet established
  whether the profile meets the gate.

An empty field is not evidence of “not applicable.” A high section count, source
count, adaptation count, Harvest Use record, or completed translation block is
not by itself sufficient to mark a profile complete. Unknown facts may remain
unknown; if such an unknown leaves a central growing decision unanswered, the
profile remains partial or pending rather than being cosmetically completed.

## Per-identity review checklist

Review the existing profile first. Preserve correct content and record only
demonstrated corrections or meaningful additions.

1. **Identity and scope** — accepted scientific identity, cultivar/type
   distinction, category, and evidence provenance are consistent. Do not
   promote crop-, species-, or genus-level facts to a cultivar claim.
2. **Established-plant cultivation** — cover the useful, applicable conditions
   supported by evidence (light, temperature, moisture, substrate/spacing, and
   system/container context only where documented). Do not confuse seed
   germination with mature-plant care, outdoor exposure with grow-light need, or
   soil spacing with hydroponic pod spacing.
3. **Growth and management** — include consequential pruning, thinning,
   support, flowering, or maintenance guidance when relevant and evidenced.
4. **Harvest and use** — say what is harvested, a defensible harvest cue or
   technique, repeat-harvest behavior when supported, and practical use or
   storage guidance. Keep controlled/commercial storage conditions distinct
   from household guarantees. Coordinate with Harvest Use rather than copying
   the same text into both layers.
5. **Problems and development signals** — include only the most useful,
   recognizable stress/pest/disease or physiological concerns supported at the
   source's actual scope. Do not make an exhaustive list for visual density.
6. **Evidence and uncertainty** — every claim has resolving source IDs and
   appropriate scope; Garden adaptations are distinguishable from sourced
   facts; confidence and `needs_validation` are honest; no unsupported
   hydroponic, cultivar, resistance, or exact-value claim is introduced.
7. **Language and boundaries** — EN/ES convey the same facts and caveats;
   cultivar names remain intact; Seed Profile covers seed-to-established-plant
   only; Plant Profile covers the established plant; private Garden X data is
   absent from public content.

Harvest Use, neighbor relations, evidence companions, and visual guides are
useful enrichment layers, but are not universal completeness quotas. Add them
when evidence makes them materially useful; absence alone does not make a sound
Plant Profile incomplete.

## Low-waste batch workflow

1. Use `plant-profile-inventory-501-20261017.csv` as the single queue. Do not
   infer completion from its structural counters; update status only after
   individual review against this rubric.
2. Select a bounded batch of 8–12 related identities (crop family, shared
   harvest/use question, or common evidence gap). Read all existing records in
   that batch before researching.
3. Build a compact evidence bundle: authoritative sources, the exact claims
   they support, taxonomic scope, regional limits, and unresolved conflicts.
   Reuse a source across identities only where its scope genuinely applies;
   fetch cultivar-specific evidence only for cultivar-specific claims.
4. Draft EN and ES from the same reviewed claim set. Avoid duplicated generic
   prose; retain explicit unknown/pending state where evidence is unavailable.
5. Review the entire batch once, then run focused source/content/inventory
   checks. Run global publisher/tests/typecheck/build at defined milestones,
   not repeatedly for each individual record.
6. Record each identity as complete, partial, or pending with a concise reason.
   Never raise an entire batch to complete solely because a shared source or
   template was applied.

## Current audit baseline

The inventory currently contains 501 identities and is not a completion claim.
After individual review of the radish, leafy-green, four-identity berry,
nine-identity pepper, eight-identity beet/carrot, four-identity scallion/onion,
and eight-identity culinary herb cohort (lemon balm, anise hyssop, catnip,
peppermint, spearmint, common sage, Greek oregano and sweet marjoram), the
summer/winter savory pair, individual reviews of caraway, chervil and flat-leaf
parsley, the fenugreek established-plant/Harvest Use review, and a four-identity
cucurbit Harvest Use cohort (acorn squash, butternut squash, Sugar Baby watermelon,
and Armenian cucumber), a three-identity melon/pumpkin Harvest Use cohort
(cantaloupe, honeydew and Sugar Pumpkin), and a two-identity Ocimum distinction
cohort (species-level sweet basil and tulsi), Mexican tarragon and pineapple
sage individual reviews, the seven-identity legume audit cohort, the
seven-identity brassica Plant Profile/Harvest Use cohort, the eight-identity
underground-storage crop review, the Empress of India nasturtium, blue borage,
German chamomile, garden pansy, Plumosa celosia, celtuce, Red Romaine, Bibb,
Buttercrunch and Iceberg lettuce Plant Profile reviews on 2026-10-17, then the
individual vegetable-amaranth and waterleaf harvest/use enrichments and blackeye
 cowpea evidence-scope correction, and established-plant reviews of corn salad,
New Zealand spinach, jute mallow, radicchio, upland cress, Tong Hao, African Marigold,
Moss Rose and Aloe vera, the inventory records 69 complete, 234 partial, and 198 pending (501 total).
The Indian blanket flower / great blanket flower species pair was individually
reviewed on 2026-10-17: established-plant guidance was separated from seed-stage
instructions, flowering and landscape use were added where supported, a
species-scoped Great Blanket Flower Seed Profile was added from University of
Idaho Extension's Western Native Plants guide, and unknown indoor compatibility
was preserved. The plant-profile gate is complete for both; numeric germination
details remain explicitly unresolved within Seed Profile where sources do not
provide them. The purple/pale purple coneflower species pair was then reviewed
using Clemson and Iowa State Extension sources: regional bloom/size ranges and
different deadheading/seed-head goals were kept explicit, E. purpurea's
species-specific seed protocol was added, and E. pallida's sowing guidance was
kept in Seed Profile rather than mature-plant care. Tennessee Coneflower was then
reviewed against NC State and University of Tennessee Extension: established
light/moisture, size, bloom, wildlife use, and pest signals were added; the
cross-pollination caveat was preserved, and no seed-start profile was fabricated
without a germination/establishment protocol.
The newly reviewed amaranth, waterleaf, corn salad, New Zealand spinach, jute mallow,
radicchio, upland cress, Tong Hao, Moss Rose and Aloe vera profiles remain partial pending remaining
Harvest Use / whole-record QA;
the cowpea correction does not
change its existing partial status.
Unknown indoor/system suitability and dimensions remain explicit where evidence
does not resolve them. Red, yellow, and broad
Sweet Spanish bulb-onion identities remain partial because the represented seed
selection's photoperiod is unresolved, a central determinant of bulb formation.
The nasturtium cohort was then reviewed against UW–Madison Extension, RHS and Kew:
Bush Nasturtium and the unnamed trailing T. majus type passed the profile gate,
with adult care, seasonal flowering and edible-use guidance kept separate from
seed instructions. Alaska Series and Empress of India remain partial/pending
because UW–Madison's 2026 treatment places them under T. minus while RHS lists
them under T. majus; Alaska's unsupported trailing compatibility claim was
removed and species-dependent habit/light left unknown. The current inventory
records 71 complete, 233 partial, and 197 pending (501 total).

The acorn and butternut squash type profiles then received a focused Cucurbita
review using Utah State University Extension: regional soil-water context was
kept out of hydroponic targets, male/female flower and pollination cues were
added to explain normal early flower drop and poor fruit set, and visible
common-pest signs were scoped to cucurbits. Their Harvest Use records cover
mature-fruit cooking and the acorn-versus-butternut curing distinction. Both
profiles now pass the Plant Profile gate while cultivar dimensions and
hydroponic suitability remain unknown. The current inventory records 73
complete, 231 partial, and 197 pending (501 total).

A focused whole-record gate then passed for Black Beauty and Patio Baby F1
eggplant. The former's Cornell participatory variety reports remain explicitly
non-trial evidence; the latter's named-hybrid and container claims remain
supplier-scoped. Both retain UMN crop-level moisture, support, flowering and
problem guidance, bilingual Harvest Use, and unknown hydroponic fit where no
system validation exists. The current inventory records 75 complete, 229
partial, and 197 pending (501 total).

On 2026-10-18, common chives and garlic chives were reviewed as a paired but
taxonomically distinct Allium cohort. Their public profiles now distinguish
the accepted species, established clump management, flowering/harvest, and
culinary use without transferring one species' claims to the other. Garlic
chive mature-size estimates remain source-framed because UNH and Wisconsin
Extension measure/describe the canopy differently. Both profiles remain
partial: system-specific hydroponic fit is not established. The inventory
remains 75 complete, 229 partial, and 197 pending (501 total).

Recompute counts from the current CSV before subsequent progress reports. The
inventory is the status authority; the section-gap matrix remains a structural
snapshot and must not be treated as an editorial completion ledger.

On 2026-10-18, a six-identity ornamental cohort (Common Morning Glory,
Flowering Tobacco Hybrid, Flowering Tobacco / *Nicotiana alata*, Four-o'clock,
Moonflower and Garden Impatiens) passed the Plant Profile gate after individual
review of identity, established-plant care, flowering, relevant safety/problem
signals, EN/ES and evidence scope. Seed-start detail was separated from Plant
Profile propagation summaries. Harvest Use was treated as inapplicable for
these non-food ornamentals; neighbor and visual-guide records were not added
because they are optional and no reviewed evidence made them necessary. Four
identities have separate Seed Profile records with unresolved numeric seed-stage
details; the two Nicotiana records are seed-grown but have no Seed Profile V0.
Those are tracked as separate Seed Profile coverage gaps and do not change the
Plant Profile status. The inventory now records 370 complete, 121 partial and
10 pending (501 total).

A first exact-text scan of the generated bilingual section guidance found 34
guidance groups repeated at least four times. Repetition is a review signal,
not an automatic defect: shared identity-scope caveats may be appropriate, but
generic care/problem statements should be checked against each plant's actual
evidence and rewritten only when identity-specific claims can be defended.
Do not auto-rewrite the repeated groups or infer that repeated text is false.

On 2026-10-18, Apple, Asian Pear, Apricot, American Persimmon and Asian
Persimmon were individually reviewed as a temperate fruit-tree cohort. The
profiles now cover rootstock/cultivar-dependent size and pollination, regional
climate context, tree training or sucker management, harvest/use, and the most
useful maturity or problem cues in EN/ES. UMN, USU, NC State and Kew claims stay
at their source scope. Unknown indoor/hydroponic fit and unassigned cultivar
traits remain explicit. All five passed the Plant Profile gate; inventory is
now 80 complete, 229 partial and 192 pending (501 total). The structural gap
matrix is only a snapshot and is not the status authority.

Also on 2026-10-18, Black Currant, European Gooseberry and Red Currant were
individually reviewed with bilingual Harvest Use guidance. Ripeness, species
distinctions, cultivar-dependent color/flavor and regional rust restrictions
remain explicitly scoped. A following berry cohort added Harvest Use for
Alpine Strawberry, Black Chokeberry and Smooth Blackberry. Smooth Blackberry
passed the gate with crop-group harvest technique clearly separated from
species-level identity. Alpine Strawberry remains partial because UMN's page
contains conflicting runner statements for the species/type; Black Chokeberry
remains partial because no supported home-propagation route is established in
its selected evidence. The current inventory records 84 complete, 231 partial
and 186 pending (501 total); recompute from the CSV before later reports.

On 2026-10-18, eight common houseplants were individually reviewed against
Kew and NC State Extension evidence. Pothos, ZZ Plant, Spider Plant, Snake
Plant, Peace Lily, Areca Palm and Dumbcane now pass the Plant Profile gate,
with pruning/seasonal care, recognizable stress or pest cues and household
safety included where supported. Peace-lily care remains explicitly at genus
scope; container guidance is not treated as indoor grow-light or hydroponic
compatibility. English Ivy remains partial because the selected evidence
supports its distinct growth phases, regional outdoor containment concern and
safety, but not enough specific indoor watering/substrate guidance. The current
CSV records 93 complete, 230 partial, and 178 pending (501 total); recompute
the inventory totals from its CSV before subsequent progress reports.

A second houseplant cohort on 2026-10-18 reviewed Boston Fern, Monstera
adansonii, Nerve Plant, Norfolk Island Pine and Rubber Plant. Normal spore
structures on Boston fern were distinguished from pest/disease signs; Monstera
adansonii remains distinct from M. deliciosa; houseplant dimensions and seasonal
care are kept separate from outdoor landscape data; no ornamental was assigned
hydroponic compatibility. All five pass the Plant Profile gate with EN/ES
content and resolved sources. The inventory currently records 98 complete,
230 partial, and 173 pending (501 total).

A third indoor-foliage review on 2026-10-18 passed Monstera deliciosa,
Heartleaf Philodendron, Fiddle-Leaf Fig, Wax Plant (Hoya carnosa), and Prayer
Plant. Monstera's leaf holes are described as developing with leaf maturity;
the Hoya page now explains why spent flower spurs should be retained. Night
leaf movement in Maranta remains normal behavior, not a problem signal. EN/ES,
source scope, and unknown controlled-system suitability were checked. Current
inventory: 103 complete, 230 partial, 168 pending (501 total).

A focused ornamental-succulent cohort on 2026-10-18 reviewed Burro's Tail,
Common Houseleek, Jade Plant, Mexican Snowball Echeveria, String of Pearls,
Thanksgiving Cactus and Zebra Haworthiopsis against Kew and NC State Extension.
The profiles now distinguish normal flowering/rosette development from stress,
include relevant care and pest/rot cues, and preserve species versus hybrid
identity. String of Pearls retains NC State's conflicting trailing-length
ranges rather than selecting false precision. Outdoor/container dimensions and
light were not converted into Garden system values; hydroponic suitability stays
unknown. EN/ES, source references and profile scope were checked individually.
All seven pass the Plant Profile gate. The current CSV records 120 complete,
230 partial and 151 pending (501 total); recompute counts from the CSV before
future reports.

A three-fern ornamental cohort on 2026-10-18 reviewed Bird's Nest Fern,
Common Staghorn Fern and Delta Maidenhair Fern against Kew and NC State
Extension. The profiles distinguish epiphytic growth forms and their actual
media/moisture needs; normal sori and shield fronds are not mislabeled as
problems, while fern spores are not treated as seeds. A previously unsupported
pruning instruction was removed from maidenhair fern, and the documented
Florida Fern Caterpillar caveat was added. EN/ES, source references and unknown
hydroponic/system compatibility were checked. All three pass the Plant Profile
gate. The current CSV records 123 complete, 230 partial and 148 pending (501
total); recompute counts from the CSV before future reports.

A focused review of Alice Sundew on 2026-10-18 added RHS-supported rosette
dimensions, normal summer flowering and the explicit no-pruning guidance in
both languages. Cultivation, propagation and observation-led problem guidance
were retained; RHS dimensions remain descriptive profile facts rather than
Garden-system size claims. Hydroponic fit remains unknown, and edible Harvest
Use is not applicable to this ornamental carnivore. The profile passes the
completion gate; current inventory is 124 complete, 230 partial and 147 pending
(501 total), subject to a fresh CSV count before reporting.

A carnivorous-plant review on 2026-10-18 completed Cape Sundew and Venus
Flytrap. Cape Sundew now distinguishes its evergreen rhizomatous established
growth, South African regional flowering/dimensions, pot moisture context and
appearance changes from drying/transplanting; seed instructions defer to its
Seed Profile. Venus Flytrap now explains normal trap closure/reset, regional
spring flowers, water-quality and pest cues, and nursery-propagation/conservation
context. Both retain unknown hydroponic fit and have EN/ES sections and resolved
sources; edible Harvest Use is not applicable. Inventory: 126 complete, 230
partial, 145 pending (501 total), to be recomputed before future reports.

The same carnivorous-plant cohort also completed Purple Pitcher Plant. Its
profile now describes regional species dimensions without treating them as a
container footprint, normal pitcher and flower development, bog/pollinator
garden value, and vegetative propagation while deferring seed treatment to the
Seed Profile. Water sensitivity, pests and wild-collection protection remain
source-scoped; hydroponic suitability stays unknown. EN/ES and source references
were checked. Inventory: 127 complete, 230 partial, 144 pending (501 total),
to be recomputed before future reports.

A further carnivorous-plant review completed Pinguicula primuliflora and
Nepenthes × ventrata. Primuliflora's species-level rosette/crown width, sticky
insect-trapping leaves, flowers, wet-root tolerance and normal leaf-tip
plantlets were checked against Kew/NParks and its specialist source; Nepenthes
hybrid identity, pitcher habit, NParks' distinct light contexts, and indoor /
hanging-basket ornamental use were checked. No hydroponic fit, dimensions,
disease status or human food use was invented. EN/ES and source references
pass. Inventory: 129 complete, 228 partial, 144 pending (501 total), to be
recomputed before future reports.

Pinguicula 'Weser' was reviewed against its cultivar-specific RHS profile,
the Pinguicula cultivar-naming reference, and the 2026 parentage paper. Its
insectivorous rosette growth, seasonal flowers, container cultivation, seed
and offset propagation, pruning, slug/snail risk, and RHS's qualified
“generally disease-free” description are represented in EN/ES.
The redundant narrative validation section was removed because compatibility
already records hydroponic suitability as unknown; no hydroponic fit or
nutrient target was inferred. The unrepresented Harvest Use is not applicable
to this carnivorous ornamental. Inventory: 130 complete, 228 partial, 143
pending (501 total), subject to a fresh CSV count before future reports.

Anise was reviewed against NC State, Maryland, Iowa State and PROSEA at
species/crop scope. The compatibility habit and full-sun evidence now point to
NC State's direct *Pimpinella anisum* record rather than generic herb/water
references. The Spanish Plant summary no longer repeats direct-sowing and
transplant-sensitive seedling guidance already owned by Seed Profile. Published
size and harvest-cue differences remain described rather than collapsed;
hydroponic fit and system dimensions remain unknown. The existing Harvest Use
record covers both leaves and seed spice in EN/ES. Inventory: 131 complete,
227 partial, 143 pending (501 total), subject to a fresh CSV count.

Two indoor ornamental review cohorts on 2026-10-18 passed six profiles:
African Violet, Parlor Palm, Rainbow Mix Coleus, Cast-Iron Plant, Arrowhead
Plant, and Dwarf Umbrella Tree. The edits add useful adult light/water/temperature,
pruning, flowering, pest/stress, and safety context while keeping cultivar/mix
variation distinct from species-level evidence. Indoor natural-light advice was
not converted to grow-light tiers; hydroponic compatibility remains unknown.
Seed starting was not inferred from propagation listings without a protocol.
All six passed EN/ES, source-scope, and reference checks. Current CSV inventory:
137 complete, 228 partial, 136 pending (501 total); recompute before later
reports.

Four additional herb profiles were individually reviewed on 2026-10-18:
French sorrel, Garden Angelica, Hyssop, and Society Garlic. French sorrel now
records the NC State annual/perennial inconsistency alongside POWO's accepted
perennial taxon instead of flattening the source conflict. Garden Angelica
adds normal second-year flowering and explicitly leaves part-specific harvest
timing unknown, with the source's size discrepancy and safety cautions retained.
Hyssop's compatibility evidence was corrected to its own NC State species
source; outdoor full-sun/partial-shade evidence remains separate from indoor
grow-light tiers, and flowering/pest signals are now bilingual. Society Garlic
adds its documented flowering window and slug/snail damage signal. All four
remain partial; no hydroponic fit, harvest calendar, or unsupported control
method was invented. Current CSV inventory after this cohort: 151 complete,
233 partial, 117 pending (501 total). Recompute before later reports.

Feverfew and Sweet Woodruff were individually reviewed on 2026-10-18 against
their NC State Extension species pages. Feverfew now separates established
growth/light from cut-flower use and includes spider-mite and regional heat /
humidity signals; its compatibility evidence no longer points to unrelated
crops. Sweet Woodruff now describes spring flowering, landscape-scale control
of rhizomatous spread, and the source's edible-flower caution without treating
it as a food crop recommendation. Both profiles pass the completion gate in
EN/ES; indoor-system dimensions and hydroponic suitability remain unknown.
Current CSV inventory: 153 complete, 233 partial, 115 pending (501 total).
Recompute before later reports.

Common Rue was individually reviewed against NC State Extension on 2026-10-18.
The profile adds early-spring pruning, source-scoped bloom and swallowtail-host
context, root-rot conditions, and explicit contact/ingestion safety. The source
itself differs between narrative and structured bloom timing (mid-to-late
summer versus summer/fall); the discrepancy is preserved and the profile stays
partial. The taxonomy record's prior safety note was removed from its
taxonomic-conflict field; accepted identity and provenance are unchanged.
Current CSV inventory: 153 complete, 234 partial, 114 pending (501 total).
Recompute before later reports.

## 2026-10-18 — Chia and stevia established-plant review

Chia (`Salvia hispanica`) was reviewed against Kew, UCANR Santa Clara County,
and the archived peer-reviewed University of Kentucky Extension publication.
The Plant Profile now focuses on established outdoor care, source-scoped size
and light, vegetative propagation, mature seed harvest, and short-day/frost
limitations; seed-starting directions remain in Seed Profile. Harvest Use
records only the documented food use of the harvested seeds and does not invent
processing or storage instructions. Chia remains **partial** because whether
an unidentified seed selection can mature in a temperate season is a central
crop outcome and cannot be resolved from species identity alone.

Stevia (`Stevia rebaudiana`) was reviewed against NC State Extension. The
compatibility mapping now reflects the source's erect habit, 1–2 ft outdoor
height and spread, and full-sun-to-partial-shade outdoor exposure; unrelated
crop sources were removed from those claims. Flowering, flower-bud management,
leaf harvest, culinary use, pests, and overwatering/root-rot cues are covered
in EN/ES. Hydroponic suitability and indoor system dimensions remain unknown.
The species-level profile passes the completion gate; no named cultivar is
asserted.

Current CSV inventory after this review: 154 complete, 235 partial, 112
pending (501 total). Recompute before later reports.

## 2026-10-18 — Tropical rhizome and variegated mint review

Greater galangal (`Alpinia galanga`) was reviewed against Kew and UF/IFAS.
The profile now distinguishes it from culinary ginger, lesser galangal,
fingerroot, and sand ginger; adds the UF/IFAS Florida-scoped heat, shade,
moisture, flowering/photoperiod and harvest-maturity cues; and keeps rhizome
propagation distinct from seed propagation. It adds bilingual, source-backed
rhizome culinary use. Height, spread, spacing, and hydroponic fit remain
unknown; the profile passes because those unknowns do not erase the supported
practical care and harvest guidance.

Pineapple mint (`Mentha suaveolens 'Variegata'`) was reviewed against Kew, RHS,
UW–Madison Extension, and UCANR IPM. Its profile now covers cultivar identity,
variegated foliage, spreading rhizomes, outdoor care, flowering, vegetative
propagation, harvest, pest/disease cues, and bilingual culinary uses. RHS and
UW–Madison report conflicting mature height/spread descriptions; both are
preserved in the narrative while compatibility dimensions remain unknown. The
clear containment advice and other supported cultivation guidance are
sufficient for completion without manufacturing a single size estimate. No
Seed Profile is asserted for the represented clonal cultivar.

Current CSV inventory after this review: 170 complete, 227 partial, 104
pending (501 total). Recompute before later reports.

Okra (`Abelmoschus esculentus`) was reviewed using UF/IFAS production guidance
and UGA Cooperative Extension's home-garden guide. Full sun, well-drained soil,
moisture at flowering/pod development, regional soil-bed thinning, frequent
young-pod harvest, brittle branches/spine handling, and culinary uses are now
represented bilingually. Cultivar dimensions, container fit, and indoor
hydroponic compatibility remain unknown; no field spacing was converted to pod
spacing.

Malabar spinach (`Basella alba`) was reviewed against POWO and UF/IFAS HS1371.
The profile distinguishes edible B. alba from ornamental B. rubra, adds soil
context separately from nutrient-solution claims, and clarifies heat/frost,
moisture, support/pruning, harvest, and culinary uses. Hydroponic compatibility
and a single light requirement remain unresolved; the source discusses
hydroponics as a context but does not establish a validated home-system fit.
Both identities passed the individual Plant Profile gate with bilingual
Harvest Use records and no new Seed/Plant boundary changes.

Bottle gourd (`Lagenaria siceraria`) and chayote (`Sicyos edulis`) were then
reviewed as a climbing-cucurbit pair. Bottle gourd gained flowering/pollination,
site and moisture guidance, young-food-part versus mature-shell harvest/use, and
a verified Tokyo public-health warning for strongly bitter fruit. The older
warning had been attributed to NC State, which does not state it; the attribution
is corrected and separated from NC State's cultivation/use claims. Chayote now
distinguishes Kew's accepted name from UF/IFAS's synonym, documents regional
temperature/soil context, trellis and pollinator needs, variable fruit harvest,
dry-season mite signs, and bilingual culinary uses. Both keep system fit and
cultivar dimensions unknown; chayote's existing whole-fruit propagation profile
was preserved rather than rewritten as a loose-seed protocol.

Ground cherry (`Physalis pruinosa`) and tomatillo (`Physalis philadelphica`)
were individually reviewed against UMN Extension; Penn State Extension Master
Gardener guidance was added for ground-cherry habit and optional space-saving
support. Differences in ground-cherry height/spacing remain visible as regional
and group-level guidance, not a single cultivar value. Both profiles now include
bilingual harvest/use/storage guidance; tomatillo's green, firm, husk-filled
harvest and tart sauce use remain distinct from ground cherry's dry-husk/drop
maturity and ripe sweet fruit uses. No cultivar-specific claims, indoor pod
spacing, or hydroponic suitability were inferred. Both profiles pass the
individual completion gate with system-specific compatibility left explicitly
unknown. The CSV now records 162 complete, 235 partial and 104 pending (501
total); recompute these counts from the inventory before further reporting.

An eight-identity tomato cohort was then individually reviewed: Beefsteak type,
Roma type, Black Cherry, Black Krim, Celebrity, Grape tomato type, San Marzano
type, and Sun Gold F1. Existing crop-level UMN outdoor guidance was retained at
crop scope; supplier, Cornell participatory, UF/IFAS, and Delaware claims stayed
limited to their actual types or named products. Bilingual Harvest Use was added
for Celebrity slicer, grape-type fruit, and Sun Gold F1, without importing demo
data or inventing storage durations. Varying determinate/indeterminate habits,
unassigned cultivar sizes, maturity estimates, disease-resistance uncertainty,
and unknown indoor/hydroponic fit remain explicit. All eight pass individual
EN/ES and source-scope review; the inventory now records 178 complete, 219
partial, and 104 pending (501 total).

Eight additional Brassica profiles passed individual review: Calabrese broccoli,
broccoli raab, Brussels sprouts, Snowball cauliflower, kohlrabi, Napa cabbage,
Red Acre cabbage, and Savoy cabbage. UMN's crop guidance and UC Master Gardener
rapini evidence remain at their actual regional/crop/type scope. The review
preserved the distinct harvest structures (central broccoli head and side
shoots, rapini leafy shoots, bottom-up Brussels sprouts, cauliflower curd,
above-ground kohlrabi stem, and Napa/round cabbage heads), along with conditional
management and useful stress cues. White-curd leaf wrapping is limited to white
cauliflower; no pod spacing, cultivar performance, or system compatibility was
invented. EN/ES and Harvest Use references passed review; no material
needs_validation item remains in these records. The inventory now records 178
complete, 219 partial, and 104 pending (501 total).

## Leafy-greens completion cohort — 2026-10-18

Six edible leafy identities were individually checked against the current
English Plant Profile, Spanish translation, source scopes, and Harvest Use:
Red Mustard Greens, Red Russian Kale, Redbor Kale, Rainbow Swiss Chard, Tatsoi,
and Water Spinach. Bilingual Harvest Use was added for all six with crop/type
scope retained. The four first identities pass the Plant Profile gate; Tatsoi
remains partial because indoor/hydroponic fit is unestablished. Water Spinach is
now reviewed rather than pending, but remains partial because it is federally
listed as a noxious weed and state-level cultivation rules are location-specific
and must be verified before acquisition or cultivation.

UMN's flea-beetle signs and management are limited to mustard/brassica crop
scope, not Red Mustard cultivar resistance. Red Russian and Redbor food use
remains general kale guidance, not type-specific culinary claims. Rainbow
Swiss-chard storage sources disagree on household duration; the Harvest Use
record names this conflict and avoids a fixed shelf-life promise. Tatsoi's mild
Asian-green use is supported by OSU and Alaska Extension. Water Spinach's fresh
or cooked use is separated from legal permission; APHIS's current federal list
and UGA's May 2026 Georgia production report are cited, with no universal state
legality claim.

The inventory now records 182 complete, 216 partial, and 103 pending (501
total). Harvest Use coverage is 267 identities across the base and additive
layers; it remains an enrichment measure, not a Plant Profile completeness
proxy.

## Individual review — garlic — 2026-10-18

The species-level garlic record was audited in EN/ES against Kew and Utah State
University Extension. The profile distinguishes *Allium sativum* from elephant
garlic and does not assign hardneck/softneck type or a named cultivar. Its
established-plant sections cover field-context cultivation, clove-derived bulb
growth, harvest and curing cues, and useful pest/storage-risk signals. Harvest
Use treats scapes as conditional on hardneck growth and avoids a universal
storage-duration promise. Garlic is propagated here by cloves, so no botanical
Seed Profile is appropriate. Hydroponic fit, indoor light tier, and system
spacing remain unknown rather than inferred. The record passes the individual
completion gate; inventory counts are now 183 complete, 216 partial, and 102
pending (501 total).

On 2026-10-18, the public input/index reconciliation established that 492
profile-array IDs and 26 public enrichment records have 12 overlaps; the 506-ID
union contains five aliases, leaving 501 published identities. This reconciles
input records with the public count but does not change editorial statuses. See
`PUBLIC_PROFILE_RECONCILIATION_501_20261018.md`.

## Focused indoor-foliage enrichment — 2026-10-18

Monstera (*Monstera deliciosa*) now states NC State's typical 6–8 ft home
height, 60–85°F indoor range, top-quarter-to-third dry-down cue, seasonal
prune/repot and leaf-cleaning maintenance, and the source's ingestion/fruit
caveat. These are species-level houseplant facts, not system dimensions or a
hydroponic recommendation. Jade plant (*Crassula ovata*) now carries NC State's
pet-ingestion caution alongside the existing overwatering and pest signals.
Both changes were translated in Spanish and mirrored to the generated public
Plant Profile index; existing source IDs resolved, so no registry entry was
needed. Compatibility values, Seed Profiles, Harvest Use, and private data
were unchanged. Fiddle-leaf fig (*Ficus lyrata*) also gained its source-scoped
temperature/humidity, seasonal patio transition, and leaf-length context in
both languages. Inventory remains 487 complete, 9 partial, and 5 pending.

## Indoor ornamental whole-profile gate — 2026-10-18

Giant Bamburanta (*Ctenanthe oppenheimiana*) and Purple Heart
(*Tradescantia pallida*) passed the Plant Profile gate after whole-record
review against Kew and NC State Extension in EN/ES. Their ornamental
development, established-plant care, flowering, problems and vegetative
propagation are covered; neither has a seed-start protocol in the selected
evidence, so no Seed Profile was manufactured. Source-reported landscape
dimensions are kept distinct from indoor-system dimensions, and hydroponic fit
remains unknown. Optional Harvest Use, companion and visual-guide records were
not treated as completion requirements. This review also found and corrected a
Spanish/English section mismatch in Polka Dot Plant; its profile remains
partial pending a separate Seed Profile disposition because NC State lists
both seed and cutting propagation but supplies no sowing protocol. Inventory:
227 complete, 201 partial, 73 pending (501 total).

## Tropical ornamental profile review — 2026-10-18

Five tropical ornamental profiles were reviewed individually in EN/ES with
identity, source scope, mature-plant care, management, problem cues, and
compatibility unknowns checked: Arabian Jasmine, Cape Jasmine/Gardenia,
Chinese Hibiscus, Flamingo Flower/Anthurium, and Florist Kalanchoe. All five
now pass the Plant Profile gate. Arabian jasmine's dried-flower tea-scenting
use is distinguished from eating the flower; no home harvest/drying protocol
is inferred. Gardenia and Chinese Hibiscus have safety-qualified Harvest Use
records: NC State supports the species-level edible-flower listing, while
Illinois Extension's newly registered advice (newly opened blooms, early
harvest, prompt cooling/use) is explicitly general edible-flower handling, not
a species-specific trial or recipe. Gardenia retains NC State's high-level
propagation routes without a fabricated seed protocol; Hibiscus retains its
stem-cutting guidance. The Anthurium care source is genus-level and stays
explicitly genus-scoped; Kalanchoe's long-night flowering cue is not treated
as germination lighting; jasmine's landscape dimensions are not substituted
for indoor-container size; and the Hibiscus hybrid-cultigen naming difference
is retained. No content was padded to create symmetry, and no hydroponic
suitability was inferred. Counts: 188 complete, 216 partial, and 97 pending
(501 total).

## Annual ornamental flower whole-record gate — 2026-10-18

Globe Amaranth, Love-in-a-Mist, White Sweet Alyssum and Lacy Phacelia were
audited as four distinct annual-flower profiles rather than treated as one
template. Their eight-section EN/ES profiles cover identity, established
conditions, growth/management, flowering, appropriate ornamental harvest/use,
and source-scoped problems. Phacelia's cover-crop termination stage remains
unspecified; this is not filled with a generic date. Globe amaranth's
conditional cut-flower adaptation is not turned into a deadheading requirement;
Love-in-a-Mist's deadheading-versus-pod tradeoff is retained; White Sweet
Alyssum's white type is not promoted to a named cultivar. Unknown hydroponic
and indoor suitability remain absent from the claims. All four pass the
individual profile gate; lack of a separate edible Harvest Use record is
appropriate for these represented ornamental uses. Inventory: 192 complete,
212 partial, 97 pending (501 total).

## Leafy greens hydroponic evidence gate — 2026-10-18

Arugula, Baby Spinach and Collard Greens passed a further whole-record review
after direct institutional hydroponic evidence was checked. Arugula now cites
Virginia Cooperative Extension's crop-level NFT guidance and UGA's greenhouse
DWC research on the named Slow Bolt selection; the legacy source ID that
incorrectly said "Johnny's" was renamed to reflect the actual UW–Madison
publisher and URL across Plant, Seed and Harvest Use references. Baby Spinach
now distinguishes UGA's selected-cultivar DWC results from UF/IFAS's Florida
heat/pathogen and method trade-offs. Collards now include UF/IFAS's broad
mature-height context and evidence of hydroponic production with an explicit
warning that robust growth does not fit every system. EN/ES are aligned; no
source nutrient concentrations were turned into Garden Nutrient Engine
mappings, device compatibility, or pod spacing. Endive remains partial: the
hydroponic forcing evidence found applies to Belgian endive, not this catalog's
Cichorium endivia identity, so that mismatch is not hidden or generalized.
The current inventory records 195 complete, 209 partial and 97 pending (501
total).

## Garden cress established-plant completion — 2026-10-18

Garden Cress (*Lepidium sativum*) was reviewed against Kew, Utah State
University Extension, and Johnny's. USU's peer-reviewed species-level guide
supports outdoor/container light options, very moist soil, annual habit,
shallow-root/weed management, leaf harvest and culinary use. Johnny's 7–10-day
harvest cue applies to its Wrinkled Crinkled Cress type, while USU describes
2–3 weeks after emergence for garden-cress leaves; both timings remain scoped
to their respective crop contexts. No mature dimensions, indoor lamp tier,
hydroponic suitability, or household storage duration was inferred. A fresh-use
Harvest Use record was added without inventing preservation guidance. The
Plant Profile gate passes; Seed Profile germination conditions remain a
separate explicit open question. Inventory: 225 complete, 203 partial, 73
pending (501 total).

## Orchard fruit completion cohort — 2026-10-18

Individually reviewed European Pear, European Plum, Japanese Plum, Sour Cherry,
and Sweet Cherry. Added actionable care guidance using Utah State Extension for
pear training/thinning and harvest maturity, and Penn State Extension for
stone-fruit pruning/thinning. Region-specific dates remain labeled as regional;
the sour-cherry no-thinning rule and sweet-cherry pruning timing are not
generalized across Prunus. Japanese-plum early-bloom frost advice is explicitly
a Garden adaptation, and its unsupported pollination assertion was removed.
Sweet Cherry's seed-starting absence was removed from the established-plant
profile rather than turned into a Plant Profile gap. Unknown rootstock-dependent
size, cultivar compatibility and hydroponic fit remain unknown. Inventory now
records 232 complete, 201 partial and 68 pending (501 total); recompute from the
CSV before future reports.

## Indoor ornamental completion cohort — 2026-10-18

Individually reviewed False African Violet (*Streptocarpus saxorum*), Panda
Plant (*Kalanchoe tomentosa*), Philippine Evergreen (*Aglaonema commutatum*),
Purple Shamrock (*Oxalis triangularis*) and Ripple Peperomia
(*Peperomia caperata*). NC State Extension source pages were checked against
the existing claims; Kew taxonomy records remain the identity authority where
present. Added the seasonal flower cue for false African violet and the
indoor-rare flowering caveat for Panda Plant. Purple Shamrock now distinguishes
normal nocturnal leaf closure/seasonal dormancy from problems and states both
the source's qualified edible-leaf/flower note and all-parts toxic potential
without turning that into a food recommendation. Philippine Evergreen's care,
problem and safety guidance is explicitly genus-level; its size, grow-light and
hydroponic suitability remain unknown. All five records passed the bilingual
Plant Profile gate; no Harvest Use record was added for the represented
ornamental profiles. Inventory: 237 complete, 201 partial, 63 pending (501
total); recompute from the CSV for later reports.

## Citrus and warm-climate fruit cohort — 2026-10-18

Individually reviewed Calamondin, Meyer Lemon, Chinese Jujube, Loquat and
Starfruit against Kew taxonomy and UMN, NC State, and UF/IFAS Extension. Added
source-scoped indoor citrus temperature/light/acclimation, flower pollination,
leaf-pest monitoring and fruiting caveats; Meyer Lemon maturity cues and
indoor pollination; Loquat's listed stem-cutting route, edible flesh and the
specific cracked-kernel ingestion caution; and NC State's jujube propagation
strategy list without inventing protocols. Starfruit now distinguishes Florida
landscape pruning and harvest cues from universal advice, adds useful
waterlogging/decline signs, and retains its kidney-disease dietary warning.
Harvest Use records were added for all five with no unverified storage or
preservation procedures. EN/ES section coverage and source scope were reviewed.
Unknown hydroponic fit and non-applicable tree-size/pod spacing remain unknown.
Inventory: 242 complete, 201 partial and 58 pending (501 total); recompute from
the CSV for subsequent work.

## Warm-climate fruit completion cohort — 2026-10-18

Individually reviewed Passion Fruit (*Passiflora edulis*), Pineapple (*Ananas
comosus*), Prickly Pear (*Opuntia ficus-indica*) and Red Mulberry (*Morus
rubra*). Added bilingual Harvest Use guidance for all four from UF/IFAS, NC
State Extension and University of Nevada, Reno Extension. Passion-fruit
maturity color remains type-dependent because no purple/yellow form is
assigned; Florida timing is not generalized. Pineapple now has a mature-fruit
harvest cue, and its mature edible-fruit statement is reconciled with the
source's bromelain/irritation caution rather than overcalling ripe fruit
poisonous. Nopal handling distinguishes the UNR guide's broad *Opuntia* scope
from this species identity and emphasizes glochid removal and ripe-only fruit
harvest. Red Mulberry adds species-level winter pruning advice and the
source-backed distinction between ripe and unripe fruit. No hydroponic
compatibility, container dimensions, Seed Profile, neighbor relation, or visual
guide was invented or changed; vegetative propagation remains explicit where
relevant. EN/ES parity and all source links were checked. Inventory now records
246 complete, 201 partial and 54 pending identities (501 total); recompute
after subsequent work.

## Established-plant legume cohort — 2026-10-18

Individually reviewed Hyacinth Bean, Winged Bean, Yardlong Bean, Edamame and Provider Bush Bean. Three profiles passed the editorial gate; Edamame and Provider remain partial with explicit unresolved items. Kept seed soaking/scarification in Seed Profiles, scoped regional/cultivar claims, and added bilingual Harvest Use only where supported. The inventory is 253 complete, 203 partial and 45 pending (501 total); recompute after each cohort.

## Flower profile cohort — 2026-10-18

Completed Green Columbine, Mexican Sunflower and Resina Calendula; individually reviewed existing Hollyhock content and retained it as complete. Tiny Tim Sweet Alyssum remains deferred because its current record mixes seed-stage and established-plant claims tied to a purchase-listing source; provenance and Plant/Seed separation need review before sign-off. Added one UMN edible-flower source and a bilingual Resina Harvest Use record. Inventory: 257 complete, 203 partial and 41 pending (501 total); recompute after later cohorts.

## Brassica profile cohort — 2026-10-18

Individually reviewed Broccolini and Komatsuna. Broccolini remains an unnamed
*Brassica oleracea* horticultural hybrid type; Illinois/UMN/OSU evidence now
covers type identity, variable repeat shoots, regional field-season context,
harvest cues and a trial-scoped flea-beetle observation without assigning
cultivar dimensions or hydroponic fit. Komatsuna remains at accepted species
scope *Brassica rapa*; OSU's *var. perviridis* is retained as source wording.
Purdue's commercial Midwest guide supports baby-leaf/full-size distinctions,
approximate group-level timing, bolting risk and pest watch items; UCANR supports
regional culinary use. Both EN/ES Plant Profiles passed the individual gate;
existing Seed Profiles were not edited, and hydroponic fit/dimensions remain
unknown. Inventory after this cohort: 309 complete, 160 partial and 32 pending
(501 total); recompute from the CSV before further work.

## Common-bean whole-record follow-up — 2026-10-18

Blue Lake Pole, Blue Lake Bush, Royal Burgundy Bush and Provider Bush Bean
passed bilingual whole-record review. Corrected unrelated pea citations,
replaced crop-irrelevant light evidence with NCSU's species-level full-sun
guidance, kept cultivar/product claims at their source scope, and removed
unsupported pruning placeholders. Compatibility V1 cannot express climbing;
Blue Lake Pole therefore remains unknown in that field while its Plant Profile
clearly documents the trellis requirement. No Seed Profile changed.

Current inventory: **321 complete, 148 partial, 32 pending** (501 rows).
The validator reads 506 raw Plant records; five alias IDs reconcile to existing
canonical identities in `plant-identity-aliases-v1.json`. The publisher
successfully prepares 501 varieties, so the raw-record/canonical-identity
difference is accounted for and does not add five identities to the review
queue.

## Quinoa established-plant review — 2026-10-18

Quinoa (*Chenopodium quinoa*) passed an individual bilingual Plant Profile
review using Kew/POWO and Washington State University Extension's home-garden
guide. Added the source-supported container-fertilizer caution while keeping
the heat results regional, not universal. Harvest/use distinguishes mature
grain, saponin-coated seed, and light young-leaf harvest. Seed starting remains
in Seed Profile; hydroponic fit, spread and system spacing remain unknown.
Current inventory: 335 complete, 151 partial and 15 pending (501 rows).

## Grain sorghum established-plant review — 2026-10-18

Grain sorghum (*Sorghum bicolor*, grain type; cultivar unspecified) passed the
individual bilingual gate. Texas A&M and OSU crop guidance now supports
stage-aware cultivation, flowering/grain-fill, black-layer harvest maturity,
and regional pest/bird watch cues; NC State supports the grain-versus-forage
use distinction. Regional field data were not generalized to household systems.
No hydroponic fit, hybrid dimensions, household seed protocol, or food
processing method was inferred. Current inventory: 336 complete, 151 partial,
14 pending (501 rows).

## Indoor ornamental houseplant gap cohort — 2026-10-18

Gold Dust Dracaena (*Dracaena surculosa*) and Giant White Bird of Paradise
(*Strelitzia nicolai*) passed their established-plant gate after confirming
that unknown indoor-system dimensions and hydroponic suitability do not block
their otherwise useful, source-backed houseplant/ornamental care. NC State's
within-page flowering-season disagreement for *S. nicolai* remains disclosed;
the profile asserts no exact season and its flowering section is medium-
confidence source-backed, not silently resolved. Polka Dot Plant
(*Hypoestes phyllostachya*) was enriched in EN/ES with an RHS houseplant guide
for indirect light, minimum temperature, humidity, moisture-retentive compost,
surface-dry watering, pruning, and recognizable dry-air/underwatering cues.
Its RHS estimate of about 30 cm for a commonly sold houseplant remains distinct
from NC State garden dimensions and is not converted to a system size. RHS also
documents a basic spring seed-sowing method, correcting the former propagation
gap statement; it lacks germination duration and temperature, so no complete
Seed Profile V0 was created. All three Plant Profiles pass the individual
gate. Inventory after review: 340 complete, 149 partial, 12 pending (501 rows).

## Evidence-sharing legume cohort — 2026-10-18

Butterfly Pea, Chickpea, Mung Bean, Scarlet Runner Bean, and Southern Pea
passed their individual established-plant gate after checking identity, useful
crop/horticultural lifecycle coverage, bilingual sections, source resolution,
Harvest Use, and the Seed Profile boundary. Three records gained distinct
flowering information from existing authoritative sources. Mung bean's
non-uniform pod maturation was kept in harvest rather than mislabeled as a
problem; Arkansas-specific post-establishment weed/fertility advice remains
regional soil guidance. These records are considered complete for their
defensible home-grower scope, not complete in every possible field. Indoor
system suitability, hydroponic compatibility, and unselected cultivar traits
remain unknown where evidence is absent. The UMN beans source's claim kinds now
include flowering to match its directly supported runner-bean notes.

Inventory after this cohort: 350 complete, 139 partial, 12 pending (501 rows).

## Strawberry established-plant cohort — 2026-10-18

Monterey Strawberry passed its individual Plant Profile gate after adding
Minnesota-context outdoor cultivation, strawberry pollination, runner
management and crop-level harvest cues, while keeping UC Davis cultivar evidence
and UC IPM disease susceptibility at their actual scopes. Its public profile no
longer exposes a User Zero purchase listing or ownership-specific bare-root
details; private inventory was not modified. White Carolina Pineberry gained
type-level cultivation, fruit/maturity cues and a source-backed Harvest Use
record. It remains pending because Illinois Extension's pineberry-specific
cross-cultivar recommendation conflicts with general UMN/UConn self-fertile
strawberry guidance, and the reviewed evidence does not settle White Carolina's
own pollen fertility or independent cultivar status. Inventory after review:
351 complete, 139 partial, 11 pending (501 rows).

## Mini sweet pepper established-plant review — 2026-10-18

`mini-lunchbox-sweet-pepper` now has bilingual, source-backed established-plant
guidance for consistent soil moisture, harvest, heat-related flower drop,
crop-level hydroponic reference values, and recognizable pepper disorders.
Seedling germination/thinning were removed from Plant Profile to preserve the
Seed/Plant boundary. The exact seed-lot cultivar and cultivar-specific mature
dimensions remain unverified, so the inventory disposition is partial rather
than complete. Exact purchase-listing provenance was removed from public
sources; private seed inventory was left untouched. Inventory after review:
351 complete, 140 partial, 10 pending (501 rows).
`mini-bell-pepper` also passed its individual gate after verifying type-scoped
taxonomy, all eight bilingual established-plant sections, compatibility
unknowns, resolved sources and Harvest Use. Unknown dimensions, spacing and
hydroponic fit remain honest scope limits for this unnamed mini type.
`sweet-chocolate-pepper` passed the same gate after its bilingual Harvest Use
record was added using Iowa State's sweet-pepper use guidance and Oregon State's
scoped color description. No preservation method, shelf life, exact seed line,
dimension or maturity-day estimate was invented. Inventory after both profile
reviews: 353 complete, 138 partial, 10 pending (501 rows).
`habanero-pepper` also passed its individual gate: the Habanero type remains
distinct from any cultivar, variable pungency is explicit, all eight bilingual
sections and Harvest Use are present, taxonomy/source scope is resolved, and
hydroponic/mature-size gaps remain unknown. Inventory after review: 354
complete, 137 partial, 10 pending (501 rows).
`common-fig` received new bilingual fruiting/flowering/problem/use guidance and
a sourced freezing option. A maturity conflict between Oregon's general
very-soft/drooping cue and Illinois's Chicago Hardy-specific slightly-yielding
cue remains `needs_validation` because no fig cultivar is named. The profile
stays partial; status totals are unchanged.

On 2026-10-18, Garden Angelica received species-scoped harvest timing for
young/tender leaves and stalks and ripe seed collection from UNH Extension;
root-harvest timing remains unknown, and the identity/sap safety warning is
preserved. Common purslane received bilingual flowering/seed-release guidance
and UW–Madison's high-oxalate food-use caution. Both remain partial: Angelica's
root-harvest information is unresolved; purslane's hydroponic suitability and
indoor pod spacing remain unestablished. Companion/visual records were not
invented where no reviewed claim required them. Inventory remains 354 complete,
137 partial, and 10 pending (501 rows).

On 2026-10-18, Purple Top White Globe, Hakurei F1 and Tokyo Cross F1 turnips
passed individual Plant Profile gates after review of their seven bilingual
established-plant sections, compatibility unknowns, Seed Profile separation,
resolved references and Harvest Use. Supplier-specific variety/root-size claims
remain distinct from UMN's crop-level turnip guidance. The profiles now state
UMN's approximately 1 inch/week outdoor-soil moisture reference with regional
and system limits; unknown indoor/hydroponic fit remains explicit and does not
block these outdoor root-crop profiles. Separately, three leek identities
(American Flag, King Richard and Giant Musselburgh) now carry an explicit Kew
POWO naming conflict in taxonomy and identity evidence; their existing accepted
name was not rewritten and their status remains partial pending editorial
reconciliation. Inventory after this review: 357 complete, 134 partial, and 10
pending (501 rows).

On 2026-10-18, a seven-identity underground-crop review closed individual gates
for Rutabaga, Celeriac, Crimson Giant Radish, Horseradish, Jicama, Parsnip and
Salsify. Celeriac gained bilingual, UC ANR-backed guidance for even moisture in its
shallow root zone, careful cultivation, side-root removal/hilling, a source-
bounded harvest-size cue and recognizable leaf-miner signs; its cooking/use
instructions remain in the separate Harvest Use layer. The other five passed
after full-record checks of identity, EN/ES, source scope, established care,
harvest/use and propagation boundaries. Jicama gained a bilingual Garden
adaptation for space management based only on UF/IFAS's vine-length/space note;
no trellis or pruning rule was invented. Horseradish remains correctly without
a Seed Profile because the represented propagation is by root material. Unknown
indoor/hydroponic fit remains explicit where the evidence is outdoor soil
culture; no compatibility was inferred. Inventory after this review: 364
complete, 127 partial and 10 pending (501 rows).

On 2026-10-18, a four-profile specialty-leafy cohort was reviewed against the
whole-record gate. Common Purslane, New Zealand Spinach, and Watercress passed
with bilingual established-plant cultivation, harvest/problem guidance,
source-scoped Harvest Use, and honest unknown system compatibility; aquatic or
baby-plant evidence was not generalized to household hydroponic performance.
Waterleaf was corrected to remove seed germination from Plant problems and now
uses UF/IFAS's adult root-knot-nematode host note without inventing symptoms or
treatment. Its lifecycle remains needs_validation because Kew treats the
accepted species as annual while the UF/IFAS guide describes it as perennial.
Inventory after this review: 376 complete, 115 partial, and 10 pending (501
rows).

Perpetual Spinach was enriched and passed the individual gate using its named
RHS cultivar record: the leaf-beet identity remains distinct from true spinach;
bushy/clump habit, UK garden size range, outer-leaf maintenance, harvest and
bolting response are now represented in EN/ES. The RHS size range is not mapped
to indoor compatibility or pod spacing. Inventory: 378 complete, 113 partial,
10 pending (501).

The vegetable-amaranth record also passed its individual gate: UF/IFAS crop
guidance and Kew identity are correctly scoped; the profile distinguishes
vegetable amaranth from grain and ornamental types, and EN/ES cultivation,
repeat harvest, warning signs and food-use cautions align. Unknown cultivar
dimensions and indoor-system compatibility remain unknown without blocking the
outdoor crop profile. Inventory: 377 complete, 114 partial, 10 pending (501).

On 2026-10-18, three bean profiles (Henderson bush lima, Kentucky Wonder pole,
and Purple-Podded bush bean) passed individual established-plant gates after
bilingual checks of identity, care, harvest/use boundaries, source scope, and
compatibility unknowns. UMN's bean guidance is used only at common/lima crop
scope for recognizable pest, disease, and heat warning signs; no cultivar
susceptibility is inferred. Unsupported pruning placeholders were removed.
Kentucky Wonder's climbing habit remains outside the current Compatibility V1
vocabulary and is not mislabeled as trailing; its Plant Profile retains the
supported trellis guidance. Inventory after this review: 373 complete, 118
partial, and 10 pending (501 rows).

Eight cucurbits passed individual gates after batch review: Armenian Cucumber,
Cantaloupe, Delicata JS, Eight Ball Zucchini, Honeydew Melon, Straight Eight,
Sugar Baby Watermelon, and Sugar Pumpkin. Type/cultivar scope, crop-level versus
selection-level evidence, bilingual maturity/use cues, and labeled Garden
adaptations were checked. Unknown indoor/hydroponic performance and unsupported
dimensions remain explicit, not inferred. Inventory now records 386 complete,
105 partial, and 10 pending (501 rows).

Marketmore Cucumber also passed as an explicitly type-level record: the identity
does not imply a numbered Marketmore selection, and general cucumber guidance
is labeled at crop scope. EN/ES care, harvest, pollination and problem sections
are source-backed; unknown form and system fit are not filled by inference.
Inventory: 387 complete, 104 partial, 10 pending (501).

The cultivar-unspecified Basil profile passed its species-level gate after
adding a sourced maintenance distinction: USU supports regular leaf harvest
before flowering, while cautioning that pinching flowers alone does not
stimulate foliage. No Genovese/Thai traits or hydroponic targets were
transferred. Inventory: 388 complete, 103 partial, 10 pending (501).

Rau Ram passed after RHS-backed growth form, node-rooting stems and temperate
flowering behavior were added in EN/ES. The Kew identity remains distinct from
botanical coriander; the UK garden height is not translated into indoor size,
and hydroponic suitability remains unknown. Inventory: 389 complete, 102
partial, 10 pending (501).

Fava bean passed an individual established-plant review on 2026-10-18. The
profile's unrelated common-bean pole/bush care text was replaced with Vicia
faba-specific support guidance. RHS broad-bean recommendations support
conditional staking, flowering moisture/drainage context, and pinching after
first pods form to manage black bean aphid; UMN remains the source for
Minnesota-scoped cool-season timing, green/dry harvest, and thorough-cooking
safety. English and Spanish were aligned, and the unsupported pruning
placeholder was replaced with the cited action. Hydroponic fit and cultivar
dimensions remain unknown without blocking this outdoor crop profile. Inventory:
390 complete, 101 partial, 10 pending (501).

Black-Eyed Pea (Southern Pea) passed an individual whole-record gate on
2026-10-18. UMD Extension now supports full-sun outdoor context, frost-sensitive
warm-season timing, moisture/care during hot, dry flowering and pod set, and
fresh-versus-dry harvest cues. A Spanish problem claim had cited NC State's
long-bean page, which explicitly describes the distinct yardlong subspecies;
that scope mismatch was removed and frost guidance now cites UMD. Unknown
unnamed-cultivar growth form, size and hydroponic fit remain explicit. Inventory:
391 complete, 100 partial, 10 pending (501).

Dill ‘Bouquet’ passed its whole-record gate on 2026-10-18. Its enriched Plant
Profile already provides cultivar-scoped height, outdoor culture, wind/support
care, goal-dependent foliage/flower/seed management, harvest cues, and
crop-level problems in EN/ES, with a useful bilingual Harvest Use record.
Hydroponic suitability and system spacing remain unknown, but are not central
to the established-plant profile; seed-starting remains in Seed Profile.
Inventory: 392 complete, 99 partial, 10 pending (501).

Gai Lan passed an individual whole-record review on 2026-10-18. OMAFRA supports
the crop identity, cool-season context, repeat harvest of stalks and leaves
before flowering, culinary uses, and locally observed pest risks; Kew synonymy
is retained under *Brassica oleracea*. EN/ES were aligned. The audit removed an
unsupported separate flower-bud edibility claim and corrected a Spanish pest
sentence that had named UF/IFAS instead of the cited OMAFRA evidence. Unknown
indoor/hydroponic fit and dimensions do not block this outdoor crop profile.
Inventory: 393 complete, 98 partial, 10 pending (501).

Common Sorrel (*Rumex acetosa*) passed an individual whole-record gate on
2026-10-18. Kew's accepted identity and species context remain separate from
the RHS guide's shared sorrel-group cultivation/culinary guidance and its
common-sorrel-specific leaf/flower management. The bilingual Harvest Use is
explicitly group-scoped; older-leaf bitterness, winter dieback, and unwanted
self-seeding/waterlogging are represented without inventing pest, hydroponic,
or spacing guidance. EN/ES and source references were checked. Inventory:
394 complete, 97 partial, 10 pending (501).

Broadleaf Sage (*Salvia officinalis*) passed an individual whole-record gate on
2026-10-18. The catalog's “Broadleaf” label is retained as a common-sage type,
not promoted to a verified named cultivar; species-level growth and care remain
explicitly scoped and no type-specific dimensions are claimed. The established-
plant profile covers cultivation, woody habit, pruning, flowering, harvest, and
normal stem aging in EN/ES. Unknown hydroponic fit, system spacing, and exact
type dimensions remain visible but do not block this outdoor herb profile. The
fresh-use method now cites Illinois Extension for handling sturdy fresh herbs
including sage; Colorado State Extension remains relevant to edible-flower
safety/context. Inventory: 395 complete, 96 partial, 10 pending (501).

Pineapple Sage (*Salvia elegans*) passed an individual whole-record gate on
2026-10-18. Kew's accepted species identity, UW–Madison's established-plant
culture/maintenance/harvest guidance, and NC State's edible-flower information
remain at their true scopes. The UW–Madison and NC State differences on seed
propagation are disclosed, not collapsed into one invented rule. The bilingual
Harvest Use record covers leaves and flowers. Unknown hydroponic fit, indoor
light tier, and species-wide dimensions remain explicit; they do not prevent a
useful outdoor ornamental/culinary profile. Inventory: 396 complete, 95
partial, 10 pending (501).

Lovage (*Levisticum officinale*) passed an individual whole-record gate on
2026-10-18. Kew supports accepted identity; Illinois Extension supports the
species-level outdoor dimensions, rich/moist soil, flowering, harvest cues,
culinary uses, and Harvest Use record. Removed an unsupported implication that
lovage is unsuitable as a compact-crop substitute; EN/ES now state that the
reported 4–6 ft height is outdoor context and compact-system suitability is
unestablished. Unknown hydroponic fit/spread and seed-stage details remain
explicit; visual/neighbor layers are optional under this rubric. Inventory:
397 complete, 94 partial, 10 pending (501).

Black Seeded Simpson (*Lactuca sativa*) passed an individual whole-record gate
on 2026-10-18. Johnny's cultivar page supports the looseleaf type and its
appearance/maturity details; crop-level Johnny's/UMN/USU sources support cool
established growth, moisture, harvest, and bolting, with scope kept explicit.
The profile now includes a sourced 60–65°F mature-growth context and separates
it from seed germination temperature. Hydroponic solution references retain
their source/system context and are not cultivar-specific targets. EN/ES,
Harvest Use, and the Seed Profile cross-link were checked; dimensions and pod
spacing remain unknown. Inventory: 398 complete, 93 partial, 10 pending (501).

Society Garlic (*Tulbaghia violacea*) passed an individual whole-record gate on
2026-10-18. NC State Extension supports species identity, outdoor perennial
culture, edible leaves/flowers, and the garlic-chive look-alike; CSU Extension
lists this species among edible flowers and supports peak-bloom, pesticide-free
handling. Added bilingual Harvest Use with only source-supported uses and no
preservation or hydroponic claims. Indoor/system suitability remains unknown
and is not inferred from landscape dimensions. Inventory: 399 complete, 92
partial, 10 pending (501).

Hyssop (*Hyssopus officinalis*) passed an individual whole-record gate on
2026-10-18. NC State supports the species identity, established container/garden
culture, dimensions, spring trimming, edible leaves/young shoot tips/flowers,
and a regional nematode note; CSU Extension supports the species-listed flower
flavor and peak-bloom/pesticide-free handling. Added a bilingual Harvest Use
record without medicinal or preservation claims. Exact leaf harvest date,
indoor dimensions, and hydroponic fit remain unknown, but do not block this
outdoor/container herb profile. Inventory: 400 complete, 91 partial, 10
pending (501).

Bloody Dock (*Rumex sanguineus*) passed individual review on 2026-10-18.
UW–Madison Extension was added for perennial rosette habit, outdoor moisture and
light context, seasonal cleanup, flowering-stalk management, and common slugs,
rust, and powdery mildew. Its perennial account corroborates NC State's prose
and life-cycle field despite an inconsistent “Annual” entry in NC State's whole-
plant trait list. Flower-stalk dimensions differ between the references and are
reported as source-variable, not collapsed into a universal measurement. EN/ES,
Harvest Use, and source references were checked; hydroponic suitability remains
unknown and is not material for this outdoor edible ornamental. Inventory:
409 complete, 82 partial, 10 pending (501).

Three tomato profiles passed an individual whole-record review on 2026-10-18.
Sunrise Sauce F1 was checked against Johnny's named-product details (determinate
habit, compact/container context, concentrated orange paste fruit, maturity
estimate, resistance codes and sauce use) plus UMN crop-level care and problem
guidance. Supersweet 100 F1 was checked against Johnny's named product and
UF/IFAS cultivar context for indeterminate growth, clustered red fruit,
support, harvest and bounded resistance claims; UMN care/problems and the
bilingual Harvest Use safety boundary were checked. Yellow Pear was checked
against UF/IFAS named-heirloom fruit, vine, support, moisture, harvest and salad
claims, with UMN/USU crop-level care and post-harvest claims kept distinct.
EN/ES meaning and source scopes were reviewed for all three. Exact indoor
dimensions or Garden-device hydroponic fit remain unknown and were not inferred;
they do not block these otherwise useful established outdoor/container tomato
profiles. Inventory after the four identities audited in this continuation:
405 complete, 86 partial, 10 pending (501).

Lentil (*Vicia lens*, with *Lens culinaris* retained as a literature synonym)
passed an individual established-plant review on 2026-10-18. Added Montana
State University Extension home-garden guidance for final in-ground spacing,
cool-season culture, excess-water caution, optional trellising, green-pod use,
and dry-pod harvest; UW–Madison's field growth/lodging/shattering context stays
explicitly crop-scoped. EN/ES and source references were checked. Indoor and
hydroponic suitability, cultivar/seed class, and system dimensions remain
unknown; they are not invented. Inventory: 406 complete, 85 partial, 10
pending (501).

Orange Hat (*Solanum lycopersicum* 'Orange Hat') passed an individual
established-plant review on 2026-10-18. Baker Creek's named-product description
supports the determinate bush habit, 6–9-inch height, container context,
watering/feeding, staking and pruning notes; Iowa State supports general
container watering, harvest cues and moisture-related fruit disorders. The
compatibility record now carries the source-scoped habit and converted height;
spread, indoor light tier and hydroponic suitability remain unknown. EN/ES,
Harvest Use, source scope, and the absence of imported review anecdotes were
checked. Inventory: 407 complete, 84 partial, 10 pending (501).

Jute Mallow (*Corchorus olitorius*) passed an individual established-plant
review on 2026-10-18. The profile keeps the University of Minnesota crop-group
guidance distinct from a 1988 Nigeria-context study of edible-leaf cultivation;
the latter supports regional cultivation context, specific pest observations,
and bilingual Harvest Use describing young leaves cooked as a paste with
starchy staples. The study's local disease observations are explicitly not
generalized as resistance, and it supplies no home treatment protocol. Seed
establishment remains in Seed Profile; indoor/hydroponic fit, dimensions, and
numeric irrigation remain unknown. Inventory: 408 complete, 83 partial, 10
pending (501).

Early White Vienna Kohlrabi (*Brassica oleracea*) passed an individual
established-plant review on 2026-10-18. Wisconsin Extension's named-variety
listing supports few leaves and an approximate 55-day harvest interval, plus
outdoor full-sun, soil-moisture, shallow-root care and harvest context. The
profile separates cultivar-listed timing from crop-level stem-size cues and
does not infer mature dimensions or hydroponic suitability. EN/ES and source
scope were checked; Harvest Use remains crop-scoped. Inventory: 410 complete,
81 partial, 10 pending (501).

Blue Borage (*Borago officinalis*) passed an individual established-plant and
food-use review on 2026-10-18. The blue-flower label remains a color type, not
a cultivar. NC State Extension added species-level spreading habit and width,
light/soil tolerance, powdery-mildew context, and an important warning to use
the edible leaves and flowers sparingly because liver damage can occur. This
safety caution is repeated in bilingual Harvest Use. Hydroponic suitability
remains unknown and is not treated as a completion blocker for this outdoor
ornamental/culinary profile. Inventory: 411 complete, 80 partial, 10 pending
(501).

Cascading Petunia was reviewed against Kew POWO, University of Minnesota
Extension, and the current AeroGarden product listing on 2026-10-18. The
established-plant record now distinguishes the catalog's *Petunia × atkinsiana*
mapping from the supplier's unnamed seed lot; avoids conflating cascading,
pendulous-grandiflora, and spreading horticultural classes; adds product-scoped
bloom timing and trimming guidance; and covers ornamental bouquet cutting and
general indoor-pest warning signs. The conflicting pruning scopes are disclosed
instead of converted into a universal cutback rule. The profile remains partial
because the product page does not identify the lot's scientific taxon or a
cultivar. Inventory remains 417 complete, 74 partial, 10 pending (501).

Sweet Scabiosa (*Scabiosa atropurpurea*) passed a focused harvest-stage review
on 2026-10-18. Oklahoma State Cooperative Extension's direct-sale cut-flower
table lists *Scabiosa* spp. at the half-open stage. The Plant Profile now uses
that as a genus-scoped commercial cut-stage cue alongside NC State's
species-specific cut/dried-flower use, while explicitly excluding
cultivar-specific performance and household vase-life guarantees. Indoor-light
and hydroponic suitability remain unknown rather than inferred. The record was
individually rechecked in EN/ES and moved from partial to complete; the inventory
now records 415 complete, 76 partial and 10 pending (501).

Lemon Verbena (*Aloysia citrodora*) passed a whole-record established-plant
review on 2026-10-18. Existing Kew, NC State and Illinois Extension evidence now
supports species identity, context-separated ground/pot dimensions, outdoor
culture and frost-sensitive overwintering, pruning, seasonal leaf drop,
flowering, stem-cutting propagation, leaf harvest/use and occasional pest signs
in EN/ES. Illinois fertilizer guidance remains regional and is not a nutrient
formula. Indoor-light and hydroponic/system fit remain unknown, not inferred.
The content record is complete; inventory now records 416 complete, 75 partial
and 10 pending (501).

Aloe vera (*Aloe vera*) passed a whole-record houseplant review on 2026-10-18.
The profile preserves NC State's disagreement between its narrative and
dimensions table, plus regional/container size context from Penn State and
UF/IFAS, without inventing a universal indoor footprint. Natural window-light
guidance remains distinct from measured grow-light tiers. Compatibility size,
lamp tier and hydroponic suitability remain explicitly unknown. The
standalone `needsValidation` item was removed because the unresolved system
footprint is not required to answer the houseplant-care question and is already
represented honestly by compatibility unknowns and the sourced growth text.
The profile now covers care, morphology, flowering, offset propagation,
ornamental use, pests/root rot and safety in EN/ES; inventory records 417
complete, 74 partial and 10 pending (501).

Garden Angelica (*Angelica archangelica*) was re-reviewed on 2026-10-18 after
checking University of Missouri Extension's *Growing Herbs at Home*. The same
publication says both that Angelica roots are dug in late fall/early spring and
that its species entry collects roots in late summer of the second year. The
profile now exposes this conflict in EN/ES rather than selecting one date;
identity and sap/photosensitivity cautions remain visible. It stays partial
because root timing is a material harvest question. Inventory totals at that
point in the review sequence are 416 complete, 75 partial and 10 pending (501).

Bitter Melon (*Momordica charantia*) received an established-plant boundary and
evidence review on 2026-10-18. Germination conditions were removed from Plant
Profile cultivation/problems; seed establishment remains Seed Profile content.
UF/IFAS supports Florida-context trellis/pollination management and unripe
harvest, while NC State adds species-level soil/light/dimension ranges and a
mature-fruit/seed toxicity caution repeated in Harvest Use. UF/IFAS notes that
crop-specific fertilizer guidance is unavailable; cucumber commercial rates
were not mapped into Garden or the nutrient engine. The profile remains partial
because climbing has no controlled compatibility value and hydroponic fit is
unestablished. Inventory count unchanged: 411 complete, 80 partial, 10 pending
(501).

Cilantro (*Coriandrum sativum*) and Santo Cilantro received a paired but
identity-specific review on 2026-10-18. The species-level leaf-cilantro profile
now keeps germination in Seed Profile and describes established outdoor
cultivation, separate leaf/coriander spacing and harvest goals, and the
recognizable leafhopper/aster-yellows warning in EN/ES. USU's different watering
advice by context is disclosed rather than collapsed into a numeric schedule.
Santo's supplier-described slow-bolting selection claim remains bounded to that
named product; USU crop guidance is not promoted to cultivar performance. Its
Garden actions now distinguish leaf harvest from coriander-seed harvest and do
not promise repeat harvest or a fixed Santo date. Both have unknown
hydroponic-system fit and no nutrient-engine mapping; that remains INSUFFICIENT
and is not invented. Santo passes the outdoor/container Plant Profile gate;
species-level cilantro remains partial while the hydroponic target question is
tracked as an unresolved product-specific capability. Inventory: 412 complete,
79 partial, 10 pending (501).

Red Cabbage and Romanesco Cauliflower passed individual whole-record reviews on
2026-10-18. Red Cabbage's identity evidence was corrected: a Brussels-sprout
source was replaced with UW–Madison's cole-crop guide, which lists Red Acre and
Red Danish as specialty cabbage cultivars; the catalog identity remains a
generic red-cabbage type. UMN's cabbage guide supports the established head,
moisture, central-growing-point, harvest and splitting guidance. Romanesco's
UW–Madison evidence supports its horticultural type, spiral head, variable
size, outdoor care, caterpillar risks, one-main-head harvest behavior and
culinary use; a bilingual Harvest Use record was added from that same source.
Neither profile inherits a named cultivar's dimensions or an unverified
hydroponic/nutrient mapping. EN/ES, Seed Profile separation, source references
and Harvest Use were checked. Inventory: 414 complete, 77 partial, 10 pending
(501).

On 2026-10-18, a focused whole-record gate passed for Common Chives, Curled
Chervil, Garlic Chives, and Italian Giant Parsley. Their public EN/ES profiles cover resolved
species/type scope, established cultivation and management, harvest/use,
relevant development or problem signals, and appropriately scoped research
context. Exact named-selection equivalence, mature dimensions, consumer-system
fit, and numeric nutrient targets remain unknown where evidence does not
support them; these optional uncertainties are explicit and do not block the
general plant-care guidance. Compatibility and nutrient-engine mappings were
not changed. Structural inventory counters were corrected against current
enrichment records. Inventory now records 421 complete, 70 partial, and 10
pending (501).

Black Viola (*Viola cornuta*) passed the whole-record gate on 2026-10-18 as an
ornamental product identity. Gardyn and Kew support the represented species;
NC State supports useful outdoor care, seasonal flowering, management and
species-level pest watch items. No named cultivar, edible-product use, or
universal hydroponic fit is invented. Food use is not a required Harvest Use
deliverable for this ornamental profile, and unsupported portions remain
explicitly absent/unknown. Inventory now records 422 complete, 69 partial, and
10 pending (501).

Blush Hibiscus (*Muenchhusia moscheutos*, Gardyn Blush/Red selection) passed a
product-aware whole-record gate on 2026-10-18 after the existing Gardyn guide
was read in full. Its previously missing established-system instructions now
cover product-specific light-zone and size descriptions, root checks, topping,
support, bloom waves, discoloration context, and cut-flower harvest; outdoor
NC State species claims remain separate. Gardyn's edible-part statement is
explicitly reported as a product claim and is not generalized into culinary
guidance without independent food-safety and treatment-history evidence. The
fall stem-cleanup conflict in NC State remains disclosed. Non-Gardyn
compatibility, spacing and nutrient mappings remain unknown and unchanged.
Inventory now records 423 complete, 68 partial, and 10 pending (501).

Pink Petunia passed a product-aware established-plant gate on 2026-10-18 after
review of Gardyn's current guide. Product-specific light/temperature context,
size/cascading description, root care, support, deadheading/pruning, cut-flower
use and its explicit non-edible warning are now represented. UMN/Clemson
outdoor guidance remains separate; no formal horticultural group, named
cultivar, non-Gardyn compatibility or nutrient mapping was invented. EN/ES,
source scope and references were checked. Inventory now records 424 complete,
67 partial, and 10 pending (501).

Seaside F1 Spinach passed an established-plant review on 2026-10-18. The public
Plant Profile now separates mature growth, cultivation, moisture, harvest,
bolting, crop-level hydroponic references and race-specific resistance from
germination/thinning retained in Seed Profile. A personalized sentence was
removed; no private inventory data was used. Seaside maturity remains counted
from direct seeding in Seed Profile, not as time after establishment.

Schiller's Moth Orchid passed an established ornamental review on 2026-10-18
using Kew, NC State Extension, RHS and American Orchid Society evidence. The
profile now covers bark culture, watering, flower initiation, spent-spike care,
keiki propagation and pests. Conflicting size/difficulty characterizations are
kept visible; compatibility size and hydroponic/system fit remain unknown. No
Seed Profile or cultivar identity was invented. EN/ES and source references were
checked. Inventory now records 426 complete, 67 partial, and 8 pending (501).

Peanut (*Arachis hypogaea*) passed an established-plant review on 2026-10-18.
NC State Extension supports species-level outdoor full-sun exposure; the profile
adds this separately from indoor grow-light needs. A care section documents
geocarpy-aware weed management, while explicitly dating Iowa State's shallow-
cultivation advice to 1997 and treating it as corroboration. Harvest now includes
UF/IFAS's pod-opening/darkening maturity cue without assigning type-specific
maturity days to this unspecified market type. EN/ES, Harvest Use, source scope,
and the Seed/Plant boundary were checked. Mature dimensions, spacing and
hydroponic fit remain unknown rather than inferred. Inventory now records 427
complete, 66 partial, and 8 pending (501).

Cilantro (*Coriandrum sativum*) received a scoped hydroponic evidence update on
2026-10-18. A peer-reviewed University of Costa Rica study used cultivar Caribe
in hydroponic stone-powder substrate with drip fertigation and compared two
nutrient concentrations in 2015–2016 rainy-season trials. Published solution
pH/EC pairs are retained only as experimental conditions, not as species
targets or Calculator mappings. Compatibility is conditional for that
substrate-based production context; recirculating home systems and nutrient
targets remain unverified/INSUFFICIENT. EN/ES and source scope were updated; the
inventory stays partial because evidence does not establish household-system
compatibility or a usable nutrient recommendation.

French Sorrel (*Rumex scutatus*) passed an established-plant review on
2026-10-18. Kew POWO and Illinois Extension support perennial identity; NC
State's narrative also calls it perennial, while its structured trait table
labels it annual, so that internal inconsistency remains disclosed. Illinois
Extension adds stalk-removal and periodic division guidance, harvest through
the season as needed, flavor variation, culinary uses, and an oxalic-acid
caution. Added source-backed outdoor full-sun/partial-sun values without
converting them to indoor grow-light needs. No hydroponic fit or spacing is
inferred, and no seed-starting protocol is copied into Plant Profile. EN/ES,
Harvest Use and source scope were reviewed. Inventory now records 428 complete,
65 partial and 8 pending (501).

Pigeon Pea (*Cajanus cajan*) passed an established-plant review on 2026-10-18.
USDA NRCS and ICRISAT support species-level growth variability, warm-climate
outdoor care, photoperiod-sensitive flowering, household green-pod harvest,
and production-level pest/disease watch items. USDA's warning against eating
unprocessed seed is retained; the older ICRISAT pesticide schedule is excluded.
The profile distinguishes green-pod use from dry-seed harvest and points seed
establishment to the separate Seed Profile. No cultivar dimensions, home
spacing, or hydroponic fit are inferred. EN/ES, source references and Harvest
Use were checked. Inventory now records 429 complete, 64 partial and 8 pending
(501).

Cherry Bomb Tomato (*Solanum lycopersicum*) passed an individual established-
plant review on 2026-10-18. Johnny's product documentation confirms the named
Cherry Bomb F1 is indeterminate, gives field support/pruning guidance, and
provides product-scoped fruit, maturity, and resistance facts. UMN Extension
supports crop-level outdoor light, moisture, flowering, and repeated-harvest
cues; Illinois Extension supports type-aware pruning. Field row distances are
explicitly not system/pod spacing. Exact mature dimensions and hydroponic fit
remain unknown; neither blocks useful field-cultivation guidance. EN/ES and
Harvest Use alignment were checked. Inventory counts should be recomputed from
the CSV after this review.

Tomato editorial cohort reviewed on 2026-10-18: generic Cherry Tomato, Large
Red Cherry, Micro-Tom, Patio Tomato, Tiny Tim, and Yellow Brandywine were
checked alongside Cherry Bomb. Type and product claims now remain in their
proper scopes; generic tomato advice does not stand in for a cultivar, and
unknown indoor fit, exact dimensions, or system spacing remains unknown where
the sources do not establish it. Micro-Tom's compatibility habit/height had
incorrectly cited Orange Hat; those values now cite NParks' Micro-Tom record
(15–20 cm maximum height, dwarf/determinate/bushy). Micro-Tom and Tiny Tim
source conflicts over fruiting dates remain disclosed, but neither profile
publishes an unsupported day count; both use observable fruit cues. Patio
tomato care now distinguishes variable determinate/indeterminate habits.
EN/ES, source references, Harvest Use where present, and compatibility records
were checked. Inventory now records 450 complete, 45 partial, and 6 pending
(501 total).

English Thyme (*Thymus vulgaris*) was re-evaluated against the completion gate
on 2026-10-18. The public adult-plant view contains bilingual outdoor
cultivation, source-scoped size, restrained care, type-scoped pinching and
harvest, flowering cues, problems, and Harvest Use. Its hydroponic study is
clearly limited to an aerated research system and does not establish consumer
appliance fit or nutrient targets. Those remain unknown, but do not leave the
central soil/container growing decision unanswered, so the profile is complete.

Lavender Vera and Spearmint were also re-evaluated on 2026-10-18. Both public
profiles have bilingual, source-scoped established-plant identity, cultivation,
growth/management, harvest and useful problem or flowering guidance. Lavender
Vera's type-level dimensions and pruning remain clearly English-lavender
guidance, not cultivar trials; Spearmint's rhizomatous spread and repeat harvest
are represented without seed-start content. Consumer hydroponic fit and
nutrient targets remain explicitly unknown for both. This optional system
dimension does not block their soil/container-relevant profiles; no nutrient
mapping or compatibility claim was added.

Purple of Sicily Cauliflower and Radicchio were reviewed as a cool-season
curd/leaf-head cohort on 2026-10-18. Their established-plant records preserve
the horticultural type rather than implying a specific unverified cultivar;
cover moisture/head development, actionable harvest cues and use, and
source-scoped stress or management signals in EN/ES. Purple of Sicily's
supplier-specific cooking-color statement stays product-scoped, and the
harvest section was correctly classified as source-backed rather than a Garden
adaptation. Exact dimensions and hydroponic fit remain unknown and do not block
their useful soil-grown profiles. Inventory now records 455 complete, 40
partial, and 6 pending (501 total).

Mexican Sunflower (*Tithonia rotundifolia*) received a targeted cut-flower
evidence update on 2026-10-18. The University of Kentucky Center for Crop
Diversification / University of Tennessee cut-flower profile supplies the
missing species-level harvest cue (petals unfurled from the center) and warns
of a delicate neck. EN/ES now state the cue and keep its Tennessee production
scope; no vase-life guarantee or cultivar claim is made. NC State and Wisconsin
Extension height ranges remain conflicting and are not averaged into a
compatibility maximum. The profile passes with hydroponic fit and compatibility
height still unknown. Inventory now records 456 complete, 39 partial, and 6
pending (501 total).

Red Onion, Yellow Onion, and Sweet Spanish Onion were re-reviewed as broad
bulb-onion type identities on 2026-10-18. USU Extension explicitly separates
photoperiod response from bulb color, shape, flavor, and market use; UMN and
Illinois Extension show why a named seed selection must match local conditions.
The bilingual profiles now give growers that selection rule while preserving
unknown cultivar/day-length classes rather than inventing one for a generic
color/type record. Their established-plant moisture, harvest, curing, and
problem guidance remains source-backed. At the scope represented, the key
growing decision is now answered, so all three pass; cultivar-specific class
and hydroponic fit remain unknown. Inventory now records 459 complete, 36
partial, and 6 pending (501 total).

Taro (*Colocasia esculenta*) passed an individual established-plant review on
2026-10-18. The profile now distinguishes NC State's warm-season container
guidance, Hawai‘i CTAHR's regional huli/corm propagation practice, and
UF/IFAS's Florida commercial 6–10 month maturity window; neither regional
practice is presented as a universal home schedule. EN/ES preserve the full
cooking-safety boundary. Indoor-light tier, home harvest cue, hydroponic fit,
and cultivar dimensions remain unknown. The 501-row inventory now records 464
complete, 31 partial, and 6 pending.

Adzuki Bean (*Vigna angularis*) then passed an individual whole-record gate
after a UF/IFAS home-garden source was added alongside existing UW–Madison and
Oregon State crop evidence. EN/ES now distinguish a Florida-scoped tender snap-
pod harvest from dry-seed harvest and disclose cultivated growth-form
variation. Florida row spacing/calendar were not generalized; exact seed-lot
habit and compact/hydroponic fit remain unknown but are not blockers for this
species-level outdoor profile. Seed Profile, taxonomy, and private inventory
were unchanged. The current 501-row inventory records **466 complete, 30
partial, and 5 pending**; counts are from the CSV, not the section-gap matrix.

Garden Angelica (*Angelica archangelica*) then passed an individual EN/ES
review on 2026-10-18. RHS outdoor cultivation, deep-taproot/container limits,
root-disturbance sensitivity, and post-flowering management were added with UK
scope. OMAFRA's Ontario commercial root-harvest timing is distinguished from
Missouri Extension's internally conflicting dates and is not generalized into
a household method. Leaf/stalk/seed harvest and safety remain supported; root
use stays qualified and hydroponic fit unknown. The inventory then recorded
467 complete, 29 partial, and 5 pending (501 total).

Roselle (*Sabdariffa gossypiifolia*) passed a whole-record gate on 2026-10-18.
Kew's accepted name and the horticultural use of its synonym were reconciled;
the profile already covered outdoor cultivation, day-length/season constraints,
calyx maturity and harvest, use, and regional stress/pest cues in EN/ES. UF/IFAS
size examples conflict, so mature size stays unknown; hydroponic fit and pod
spacing also remain unknown. These gaps do not block the useful outdoor profile.
Inventory now records 468 complete, 28 partial, and 5 pending (501 total).

A three-identity leek cohort (American Flag, King Richard, Giant Musselburgh)
passed individual review on 2026-10-18. Kew POWO's accepted Allium porrum name
was selected; USDA GRIN's synonym and alternative Leek/Porrum Group treatment
remain explicit in taxonomy provenance. UW–Madison's named-variety entries
support cultivar-scoped descriptions, with general crop guidance kept at crop
scope. American Flag's previously pending pruning item is now expressed only as
an optional crop-level midseason leaf cut. EN/ES, Plant Profiles, and Harvest Use
were checked. Hydroponic suitability, indoor spacing, and unverified dimensions
remain unknown rather than being inferred. The inventory now records 471
complete, 25 partial, and 5 pending (501 total).

Florence Fennel also passed the whole-record gate on 2026-10-18. Its profile
keeps bulb-fennel establishment and mature cultivation separate from Seed
Profile germination, and covers moisture, bolting/splitting, harvest, use, and
management in EN/ES. Compact hydroponic suitability and EC/pH remain unknown.
The fit warning is now explicitly a source-backed Garden adaptation grounded
in the crop's swollen edible base and taproot, not an unsupported compatibility
claim; no hydroponic recommendation is made. Inventory now records 472 complete,
24 partial, and 5 pending (501 total).

Oats (*Avena sativa*) passed a scope-specific whole-record gate on 2026-10-18.
The catalog entry is explicitly about its cover/nurse-crop use, not an
unspecified grain or forage cultivar. UMN's vegetable-cover guidance now
accurately describes the source registry scope and supports quick establishment,
soil-cover functions, winter-kill, residue timing, mixing/nurse-crop use, and
the distinct termination rule versus spring barley/wheat. EN/ES were updated
from that claim set. Indoor/hydroponic fit, household dimensions, and a precise
home sowing protocol remain unknown; these are not inferred from field rates.
No food-grain Harvest Use was added to a record categorized as a cover crop.
Inventory now records 473 complete, 22 partial, and 6 pending (501 total).

Wasabina Mustard Greens received a product-scoped update on 2026-10-18 from
Hudson Valley Seed Company's Wasabina listing: seller-described pungent/zesty
wasabi-like flavor, 6 in mature height and width, full sun (8+ hours), and a
45-day-to-maturity estimate. The estimate has no defined timing anchor and is
not shown as a guaranteed harvest date; 12 in field spacing is not mapped to
hydroponic pods. Extension guidance remains crop-scoped, and the Kew/USDA
taxonomy conflict remains open, so the inventory status stays partial pending
editorial reconciliation rather than being upgraded for more filled fields.

Waterleaf (*Talinum fruticosum*) passed an individual whole-record gate on
2026-10-18. Kew's species-level annual life-form and UF/IFAS's Florida crop and
Singapore NParks' local perennial cultivation descriptions are now presented
with their actual scopes; the profile makes no universal lifespan or
overwintering promise. Adult outdoor/container care, repeated shoot harvest,
flowering, stem-cutting context, food-use cautions, and root-rot/nematode cues
are covered bilingually. Indoor dimensions and hydroponic fit remain unknown.
Inventory now records 474 complete, 21 partial, and 6 pending (501 total).

Chia (*Salvia hispanica*) passed a whole-record gate on 2026-10-18. The
species-level profile covers established outdoor care, frost sensitivity,
short-day flowering, and seed harvest in EN/ES. It warns that standard chia
may not mature seed before frost in temperate regions and does not assign
University of Kentucky's selected long-day breeding lines to an unidentified
packet. Packet-specific adaptation and controlled-system fit remain unknown;
they do not leave a gap in the supported general species profile. Inventory
now records 475 complete, 20 partial, and 6 pending (501 total).

Common Mint (*Mentha* spp.) passed a genus-scope whole-record gate on
2026-10-18. The profile explains that it does not identify peppermint,
spearmint or a cultivar; established outdoor care, rhizomatous spread,
pinching, repeated harvest and recognizable disease-warning signs remain
applicable at the selected genus scope. A Brazilian NFT experiment is cited
only to explain that it studied *Mentha arvensis* cv. IAC 701, not this
unresolved genus-level identity. Hydroponic fit and nutrient targets stay
pending; those optional system unknowns do not make the outdoor profile
incomplete. Inventory now records 476 complete, 19 partial, and 6 pending
(501 total).

An audit of the generated public Plant Profile catalog on 2026-10-18 found 359
long exact English/Spanish matches in section `short` labels across 104
identities; no long exact matches were found in `guidance` fields. This is a
translation-coverage signal, not proof that every match is erroneous (proper
nouns and technical labels need review). Added Spanish short labels for all
currently identical section labels in Sweet Woodruff, Sea Thrift, Snapdragon,
and Pink Turtlehead (18 labels across four identities). Their Plant facts,
source scopes, and editorial statuses were not changed. After regeneration,
353 such matches remained across 100 identities. A second batch translated 14
short labels for cultivated rice and spring barley, preserving the distinction
between the rice production systems and the Minnesota field scope for barley.
Further short-label translations covered grain sorghum, proso millet, adzuki,
and pigeon pea (19 labels across those four identities). Across these batches,
51 labels have now been translated in ten identities. After regeneration, 325
long exact English/Spanish short-label matches remained in the generated index;
continue to review proper nouns and technical terms before treating any match as
a translation defect.

Red Streaks Mizuna passed a whole-record gate at supplier-listed mizuna-type
scope on 2026-10-18. Replaced compatibility evidence incorrectly borrowed from
a kale source with RHS guidance specific to mizuna, representing sun and
semi-shade as outdoor conditions only. Removed seedling thinning from the Plant
Profile because the Seed Profile covers establishment. Formal cultivar/lot
taxonomy, exact dimensions and hydroponic fit remain unknown and are not
inferred. Inventory now records 477 complete, 18 partial and 6 pending (501
total).
long exact matches remain across 94 identities; handle them in small crop or
content-type cohorts and preserve scientific names and other legitimate
language-neutral strings. Later catalog edits added short labels, so a fresh
scan of the current generated index found 525 long exact matches across 109
identities before the 2026-10-18 translation pass. Subsequent batches translated
71 evidence-aligned short labels across the American and European gooseberry,
black and red currant, two Pinguicula species, Saskatoon serviceberry, American
elderberry, and American cranberry profiles. None of their plant facts, source
scopes, or editorial statuses changed. At that checkpoint, the generated index
had 454 long exact matches across 100 identities. These are candidate translation
gaps, not automatic errors; continue reviewing proper names and technical
strings before translating each cohort.

Evergreen Bunching Onion Nabuka received a narrowly scoped supplier identity
source on 2026-10-18: Homegrown Garden's public 32-variety product listing
names “Evergreen Bunching Nabuka (Allium fistulosum).” The profile now treats
this as supplier-listed product naming and claimed species only, not as
independent cultivar registration or cultivar-specific agronomy. Its status
remains partial; no private seed ownership or lot information was used.

Horseradish (*Armoracia rusticana*) received a whole-record established-plant
enrichment on 2026-10-18 using UMN Extension alongside the existing Kew, NC
State and Wisconsin evidence. The profile now covers sunny deep moist soil,
early weed/mulch care, UMN's optional twice-lifted root-quality technique,
regional fall/spring harvest cues, and flea-beetle/root-rot concerns. All eight
sections are bilingual and source-resolved. UMN field spacing and Minnesota
timing remain explicitly regional; indoor/hydroponic fit remains unknown, and
no Seed Profile was added for this root-propagated representation.
Its eight short labels were also made bilingual; a fresh generated-index scan
now finds 448 long exact English/Spanish short-label matches across 99
identities.

Chinese jujube (*Ziziphus jujuba*) received a narrowly scoped established-plant
care addition on 2026-10-18 using UF/IFAS. The bilingual care section documents
root suckering, possible emergence several feet from the parent, and that
pruning can constrain tree size. UF/IFAS orchard training forms are identified
as such; no household pruning calendar or sucker-removal procedure is inferred.
Existing NC State cultivation, fruit maturity/use and propagation scope is
preserved; indoor/hydroponic fit remains unknown.

Mini/Lunchbox-type sweet pepper received a bilingual growth section on
2026-10-18 using University of Maryland Extension. The source's 3–4 ft crop
range, variable habit, and possible support need are explicitly crop-level;
they are not treated as measured dimensions or a support requirement for the
unresolved mini type. Exact cultivar/seed-lot identity and type-specific size
remain unresolved, so the profile remains partial.

Alaska nasturtium received an additional identity source on 2026-10-18:
University of Arkansas Extension identifies its historic Alaska selection as
Tropaeolum majus and describes variegation. This strengthens the T. majus case
but does not resolve the conflict with UW–Madison's 2026 placement of Alaska
among bush T. minus cultivars; the source may describe a different line or
naming scope. The profile remains pending and does not inherit cultivar size,
habit, or compatibility claims.

Heartleaf philodendron received a species-scoped care addition on 2026-10-18
using UF/IFAS: indoor display may trail or use a support, with training and
pruning shaping the plant; the source does not prescribe a schedule. Its
recognizable yellow-leaf and brown-tip cues were added alongside NC State's
root-rot/pest context. Natural indoor light remains distinct from a grow-light
tier, and controlled-system fit remains unknown.

A leaf-greens source-scope audit found that Red Mustard Greens (Brassica juncea)
had inherited habit and light evidence from a Johnny's kale guide. Removed that
cross-crop evidence, left the variable growth-habit enum unknown, and replaced
the grow guidance with applicable NC State and USU mustard sources for variable
leaf morphology, outdoor sun/part-shade, even soil moisture, and heat-related
bolting/flavor change. Seedling thinning remains in Seed Profile rather than
Plant Profile. The species/type profile remains complete with hydroponic fit
and cultivar-specific dimensions unknown. The inventory before the next gate
recorded 481 complete, 14 partial and 6 pending (501 total).

Lady Murasaki Komatsuna's Plant Profile was re-gated on 2026-10-18 after
separating established-plant knowledge from seed-lot genetics. Its six
bilingual/source-backed plant sections and Harvest Use support the represented
komatsuna selection. The Fedco open-pollinated vs F1 discrepancy remains in
Seed Profile, where it affects seed-saving expectations; it was removed from
Plant identity/validation and from plant-use source references. Product
dimensions and hydroponic fit remain unknown. Inventory: 482 complete, 13
partial and 6 pending (501 total).

Spring Barley (Hordeum vulgare) was individually re-reviewed: the English and
Spanish outdoor cultivation guidance now match, and NC State's broad species
landscape dimensions are present without being promoted to cultivar or indoor
size. Harvest maturity, home threshing/winnowing, and seed-lot food-use limits
are covered; unknown hydroponic fit and cultivar-specific dimensions remain
honest unknowns. Re-gated complete. Dwarf Cosmos was then re-gated individually:
its eight bilingual, source-backed sections and Harvest Use answer the needs of
an unnamed dwarf C. bipinnatus type. Exact cultivar/dimensions and system fit
remain unknown but are not material blockers for the scoped ornamental profile.
State Fair Zinnia was also re-gated: Johnny's and Eden Brothers' conflicting
product heights remain attributed to each seller, with no single public
dimension inferred for an unspecified lot; its seven source-backed bilingual
sections and Harvest Use remain useful without resolving that non-blocking
measurement. Rice was then reviewed against a UF/IFAS Charlotte County
Extension home-growing experiment: a soil pot and water-tray example for named
upland and wet-type varieties is now explicitly regional/experimental and is
not generalized to an unidentified rice lot or hydroponics. Plant Profile
records seed propagation only; lot viability and sowing protocol remain Seed
Profile matters. Its harvest-use layer and field crop guidance are bilingual;
cultivar, yield and system fit remain unknown without blocking the scoped
species profile. Inventory: 486 complete, 9 partial and 6 pending (501 total).

Cassava (Manihot esculenta) safety language was tightened in Plant Profile and
Harvest Use after adding FAO's synthesis on cyanogenic variability: taste is
not a reliable cyanide indicator, and simple boiling may not be reliable.
English and Spanish now carry the same limits; no preparation recipe was
inferred. The represented type and a complete type-appropriate process remain
unresolved, so Cassava remains partial. Inventory: 486 complete, 9 partial
and 6 pending (501 total).

White Carolina Pineberry was reassessed with US plant patent USPP34612. The
patent documents White Carolina/White Pine as an unpatented white-fruited
Fragaria × ananassa parent of QBC-1, establishing historical breeding-name use
and as the male parent in the cross that produced QBC-1. This demonstrates
historical pollen use from that unpatented parent, not self-fertility or
equivalence to current nursery stock. The patent itself
prints inconsistent USDA PI numbers, neither of which is adopted. The public
identity is therefore publishable at the supplier-listed-name scope and moves
from pending to partial; Ebert's and Raintree still conflict on pollination,
and exact stock/runner behavior remain unresolved. The male-parent finding was
added to the pollination section to distinguish pollen fertility in a cross from
self-compatibility; it does not resolve the seller conflict. Inventory remains
487 complete, 9 partial and 5 pending (501 total).

Mexican oregano (*Lippia origanoides*) received a whole-record established-plant
completion review on 2026-10-18. Brooklyn Botanic Garden adds warm-season outdoor
container culture, indoor overwintering context, a pruning response, and indoor
pest-monitoring cues; Cornell Botanic Gardens adds an outdoor shrub description.
Both sources identify the plant as *Lippia graveolens*, reconciled to Kew's
accepted *L. origanoides* synonym record. Their reported hardiness and size
descriptions differ, so the profile states the source variation rather than
choosing a universal value. Indoor dimensions, system fit and hydroponics remain
unknown, but do not block this species-level outdoor herb profile. EN/ES
sections and source references were checked; Plant/Seed and Harvest Use
boundaries were preserved. Inventory now records 487 complete, 9 partial, and 5
pending (501 total).

Prayer Plant, Satin Pothos, and Chinese Money Plant received a small
species-level indoor-foliage follow-up. Added cold/draft sensitivity and a
careful low-light-or-low-fertility foliage-color cue for Maranta, NC State's
65–85°F indoor context and direct-sun/cool-air intolerance for Scindapsus, and
English parity for Pilea's cold-draft/heat-source caution. No cultivar or
hydroponic claims were added; statuses remain 487 complete, 9 partial, and 5
pending (501 total). Details and source links: `INDOOR_FOLIAGE_SIGNAL_AND_PARITY_REVIEW_20261018.md`.

Cardoon received an established-plant maintenance section and Spanish parity
review: regional leaf trimming, seasonal dieback/regrowth, heat dormancy and
winter mulch guidance are scoped to outdoor conditions. Inventory section
counts were updated; no new source or compatibility claim was added. See
`CARDOON_ESTABLISHED_PLANT_ENRICHMENT_20261018.md`.

The three Petunia catalog records received a focused post-harvest review on
2026-10-18. UMN Extension documents occasional stem cutting for bouquets when
Petunias bloom abundantly and removing leaves that would sit below vase water.
This general guidance was added to Cascading Petunia, Gardyn Pink Petunia, and
Dwarf Bedding Mixed with product/identity scope preserved; no cut stage, vase
life, species/cultivar identity, or edible use was inferred. Gardyn's explicit
non-edibility statement remains attached only to its Pink Petunia product.
Harvest Use coverage is now 368/501; this is a record-coverage count, not a
claim that every remaining identity needs a harvest method. Cascading Petunia
remains partial because its supplied seed lot is not taxonomically identified.

Mini Sweet Bell Pepper was re-gated at an unnamed horticultural-type scope on
2026-10-18. Kew supports the accepted species *Capsicum annuum*; an identity
section and taxonomy reconciliation now make explicit that the profile is not
the named Johnny's Lunchbox series or a specified seed lot. Existing crop-level
care and harvest guidance remains useful without assigning cultivar dimensions
or maturity. The status is complete at the declared type scope; unknown exact
seed-lot cultivar, size, and timing are retained as non-blocking unknowns. See
`MINI_SWEET_PEPPER_TYPE_RE_GATE_20261018.md`. The inventory now records 488
complete, 8 partial, and 5 pending (501 total).

Wasabina mustard greens was re-gated on 2026-10-18 after checking Kew POWO's
current accepted name × *Brassarda juncea* and its synonym treatment of
*Brassica × juncea*. The supplier and USDA PLANTS use *Brassica juncea*; the
profile now follows Kew's backbone while preserving that agricultural usage as
an alternate name. The product remains a supplier-listed selection, not a
formally registered cultivar. Product dimensions/light/maturity remain scoped;
unknown system spacing and growth habit remain explicit and non-blocking for
the established-plant profile. The inventory now records 489 complete, 7
partial, and 5 pending (501 total).

Dwarf Bedding Mixed Colors Petunia was re-gated on 2026-10-18 using the current
Ferry-Morse SKU 2143 product listing. It supplies a product-scoped 12–18 in
height, compact bedding habit, full sun, average water, a 12+ in container
recommendation, seasonal bloom and a 45–80 day bloom estimate. The profile now
resolves identity to Petunia genus/product scope while leaving species, formal
cultivar and spread width unspecified; it does not convert field spacing into
pod spacing. The current inventory now records 494 complete, 4 partial, and 3
pending (501 total); these are editorial review dispositions, not a claim that
all profiles contain identical sections or detail.

Honeydew Melon received a targeted established-plant care addition: Iowa State's
honeydew/melon-group guidance now covers even soil moisture, root-zone drip,
avoiding wet conditions, and reducing each watering as fruit approaches
maturity. Regional field amounts remain explicitly non-universal; no
hydroponic compatibility or schedule is inferred. EN/ES, source scope, and the
inventory/gap-matrix counters were updated without changing the existing
complete disposition.

Honeydew Melon received a targeted established-plant care addition: Iowa State's
honeydew/melon-group guidance now covers even soil moisture, root-zone drip,
avoiding wet conditions, and reducing each watering as fruit approaches
maturity. Regional field amounts remain explicitly non-universal; no
hydroponic compatibility or schedule is inferred. EN/ES, source scope, and the
inventory/gap-matrix counters were updated without changing the existing
complete disposition.

Moss Rose's edibility conflict was rechecked against the current source pages.
The 2026 UF/IFAS article states that *P. grandiflora* is not edible and cites
the NC State and Wisconsin Extension pages that list edible flowers/seeds, but
does not explain a human-toxicity mechanism. This confirms a direct unresolved
conflict, not a basis to choose one claim. The bilingual public profile keeps
its no-consumption recommendation and the record remains partial.

Vegetable Amaranth received a focused established-plant care addition: UF/IFAS
states that no amaranth-specific Florida fertilizer recommendation is available,
mentions leaf-lettuce field rates only as a temporary commercial stand-in, and
warns that excessive inorganic nitrogen can pale leaves and promote nitrate
accumulation. EN/ES now state that limit without turning field rates into a
home-container or hydroponic dose. The source scope, inventory and structural
gap row were aligned; the profile remains complete at species/crop scope, with
unknown system fit and cultivar dimensions unchanged.

English Ivy received a bilingual mature-phase addition: NC State Extension
describes early-fall flowers on adult non-climbing stems followed by blue-black
berries, which helps distinguish normal phase development from a problem. The
problem section now also reflects the source's named pest/disease monitoring
list while avoiding unsupported diagnostics or treatments. Source scope,
inventory and structural section counts were aligned; North Carolina timing and
invasive status remain explicitly regional, and indoor/hydroponic unknowns were
not changed.

White Carolina Pineberry received a source-scoped propagation clarification on
2026-10-20. University of Missouri Extension lists White Carolina among
marketed pineberry cultivars and advises buying plants rather than seed to
maintain the white-fruit type. This does not authenticate current retail stock
or establish a cultivar-specific vegetative protocol, so the identity and
propagation disposition remain pending; the profile now carries explicit
resolving source IDs and remains partial.
