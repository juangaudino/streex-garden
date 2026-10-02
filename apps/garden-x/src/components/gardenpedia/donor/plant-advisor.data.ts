import type { QuickQueryPreset } from "./plant-advisor.types";

/**
 * Respuestas de demostración. Cuando el asesor se conecte a un modelo real,
 * estos presets pueden quedarse como ejemplos de UI o eliminarse por completo.
 */
export const ADVISOR_PRESETS: QuickQueryPreset[] = [
  {
    id: "beginner",
    badge: "🌿",
    title: "Principiante sin experiencia",
    query:
      "No tengo experiencia cultivando, quiero algo muy resistente que no se muera si me olvido de regar un día.",
    response: {
      query: "Principiante sin experiencia",
      summary:
        "Priorizamos especies con alta plasticidad vegetativa, raíces tolerantes a desbalances hídricos leves y arranque rápido que da retroalimentación visual temprana.",
      cultivationAdvice:
        "Empieza en macetas medianas con sustrato esponjoso; es mucho más fácil corregir la falta de agua que el encharcamiento.",
      recommendations: [
        {
          plantId: "genovese-basil",
          score: 96,
          reason:
            "Germina en 5-10 días, avisa visiblemente cuando tiene sed bajando las hojas y revive rápido tras el riego.",
        },
        {
          plantId: "common-chives",
          score: 92,
          reason:
            "Bulbo rústico casi indestructible: tolera descuidos y rebrota después de cada corte.",
        },
        {
          plantId: "common-mint",
          score: 88,
          reason:
            "Enraizamiento agresivo y muy alta tolerancia a variaciones de temperatura y riego.",
        },
      ],
    },
  },
  {
    id: "low-light",
    badge: "☀️",
    title: "Poca luz / interior",
    query:
      "Vivo en un departamento con una sola ventana al este; tengo 2 a 3 horas de sol suave al día.",
    response: {
      query: "Poca luz / interior",
      summary:
        "Descartamos plantas de flor y fruto que exigen radiación alta (>14 mol/m²/día) y seleccionamos follaje de bajo punto de compensación lumínica.",
      cultivationAdvice:
        "Ubica las macetas a menos de 50 cm del vidrio y rota cada maceta 90° por semana para evitar que los tallos se ahílen buscando luz.",
      recommendations: [
        {
          plantId: "common-mint",
          score: 94,
          reason:
            "Tolera semisombra densa y conserva su aroma incluso con pocas horas de sol directo.",
        },
        {
          plantId: "italian-giant-parsley",
          score: 90,
          reason: "Umbelífera bianual adaptada a luz difusa y temperaturas moderadas de interior.",
        },
        {
          plantId: "red-romaine-lettuce",
          score: 85,
          reason:
            "Las hojas verdes y rojas requieren mucha menos radiación que un tomate o un pimiento.",
        },
      ],
    },
  },
  {
    id: "continuous-harvest",
    badge: "✂️",
    title: "Cosecha continua",
    query:
      "Quiero cultivar en la cocina e ir sacando hojas frescas cada semana sin arrancar la planta entera.",
    response: {
      query: "Cosecha continua",
      summary:
        "Seleccionamos variedades de crecimiento indeterminado o con meristemas basales activos, que permiten cosechas fraccionadas por despunte o corte basal.",
      cultivationAdvice:
        "Corta siempre las hojas exteriores más viejas a 2 cm de la corona basal y deja el cogollo central intacto para mantener el ciclo vegetativo activo.",
      recommendations: [
        {
          plantId: "genovese-basil",
          score: 97,
          reason:
            "El despunte apical sobre el segundo nudo estimula ramificación lateral y duplica el follaje tras cada corte.",
        },
        {
          plantId: "common-chives",
          score: 93,
          reason:
            "Se cosecha como el césped: cortas a 3 cm de la base y rebrota por completo en 10-14 días.",
        },
        {
          plantId: "bibb-lettuce",
          score: 89,
          reason:
            "Permite retirar 4-5 hojas periféricas cada pocos días manteniendo la cabeza productiva varias semanas más.",
        },
      ],
    },
  },
  {
    id: "compact-hydro",
    badge: "💧",
    title: "Hidroponía compacta",
    query:
      "Tengo un sistema hidropónico pequeño en la encimera y busco cultivos enanos que no colapsen las raíces.",
    response: {
      query: "Hidroponía compacta",
      summary:
        "Filtramos por porte compacto (<30 cm), tolerancia a electroconductividad entre 1.2 y 2.0 mS/cm y raíces que no formen cepellones fibrosos excesivos.",
      cultivationAdvice:
        "Mantén el fotoperiodo entre 14 y 16 horas de luz LED y el pH del agua entre 5.8 y 6.2 para máxima asimilación de nitrógeno y hierro.",
      recommendations: [
        {
          plantId: "cherry-tomato",
          score: 95,
          reason:
            "Crecimiento determinado de porte bajo, ideal para cúpulas de luz fijas y raíces controlables.",
        },
        {
          plantId: "sweet-basil",
          score: 91,
          reason:
            "Máxima respuesta al agua oxigenada y fertilización balanceada; aroma muy concentrado bajo LED.",
        },
        {
          plantId: "cilantro",
          score: 86,
          reason:
            "Ciclo vegetativo rápido en solución nutritiva, evitando el estrés hídrico que dispara su floración prematura.",
        },
      ],
    },
  },
];
