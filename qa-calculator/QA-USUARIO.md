# Calculadora Gardenpedia: guía de QA físico

Esta guía se usa al final de la revisión de software. Las mediciones y cantidades
deben ser las reales del equipo y producto de Juan. Las calibraciones simuladas de
las pruebas automáticas no son mediciones físicas ni deben guardarse como tales.

La calculadora está en <https://garden.getstreex.com/gardenpedia/?view=calculator>.
En iPhone, anota el modo, producto y resultado de cada prueba; si aparece un error,
anota los valores introducidos y toma una captura. Conserva los datos privados y
no compartas capturas que los muestren si no deseas hacerlo.

## Antes de comenzar

- Ten el medidor de EC verificado, agua, recipiente graduado y utensilios capaces
  de medir las cantidades que muestre la calculadora. Usa las unidades visibles.
- Elige una planta y un tanque conocidos. Anota el volumen **real** y la capacidad;
  no son necesariamente iguales. Identifica el producto exacto y su formulación.
- Para FloraSeries, sigue la etiqueta y el orden de mezcla del fabricante. No mezcles
  concentrados entre sí; mezcla cada componente en el agua según sus instrucciones.
- Si falta un rango para la planta, usa un objetivo elegido por ti únicamente si ya
  cuentas con una referencia adecuada. La aplicación debe mostrar la incertidumbre.

## Registro de una medición física

Completa esto durante la primera prueba de calibración. Usa un recipiente de prueba
separado de los depósitos que alimentan plantas; no registres los valores simulados
de las pruebas automáticas como si fueran mediciones reales.

| Dato | Valor real |
| --- | --- |
| Fecha y hora | ______ |
| Planta y etapa observada | ______ |
| Sistema hidropónico | ______ |
| Fabricante, producto y formulación exacta | ______ |
| Programa y paso oficial, si aplica | ______ |
| Volumen de agua de la muestra | ______ L |
| EC del agua antes de nutrientes | ______ mS/cm |
| EC final después de mezclar y estabilizar | ______ mS/cm |
| Temperatura / ATC del medidor, si se muestra | ______ |
| Resolución indicada del medidor | ______ mS/cm |
| FloraMicro realmente añadido | ______ mL |
| FloraGro realmente añadido | ______ mL |
| FloraBloom realmente añadido | ______ mL |
| Parte A / nutriente único realmente añadido | ______ mL |
| Resolución de la jeringa o dosificador | ______ mL |
| Observaciones | ______ |

Registra solo los componentes que correspondan al producto y las cantidades que
efectivamente mediste. Si el cambio entre EC inicial y final es menor que la
resolución del medidor, no lo uses como calibración cuantitativa confiable; repite
la observación con una diferencia medible o un instrumento más preciso.

## Edad y etapa observada

- Introduce días desde siembra solo si conoces esa fecha. Si la planta llegó
  como trasplante, raíz desnuda o esqueje y no sabes cuándo se sembró, deja el
  campo vacío y selecciona la etapa que observas. El contador de llegada o
  trasplante no equivale a días desde siembra; el dato de edad es contexto y no
  cambia por sí solo la dosis.
- En un tanque compartido con la misma variedad en varias etapas, elige **Varias
  etapas**, marca cada etapa observada y registra los días de cada grupo por
  separado. Por ejemplo, Genovese Basil: Plántula = 15 días y Crecimiento
  vegetativo = 36 días. Deben aparecer por separado; guarda el sistema, recarga y
  confirma que ambas edades se restauren. Estas edades muestran referencias
  publicadas y no cambian la etapa ni la dosis automáticamente.
- Añade **Genovese Basil**, registra 15 días desde la siembra y abre la pista del
  perfil de semilla. Debe mostrar la referencia morfológica y su fuente; la etapa
  seguirá sin especificar hasta que elijas lo que observas en la planta.
- Añade **Butterhead Lettuce** con 15 días y luego 19 días. Ambos valores caen en
  la misma ventana publicada de trasplante (14–21 días), así que la pista debe
  mantenerse igual. Confirma visualmente hojas verdaderas y raíces antes de elegir
  Plántula. A los 22 días la ventana ya no aplica; la aplicación no debe inventar
  una nueva etapa ni cambiar por sí sola la dosis.
- Añade **Chinese Light Green Celery** con 90 días: debe mostrar el contexto de
  trasplante general de apio de USU Extension (79–105 días desde siembra, derivado
  de 9–21 días a germinación más 10–12 semanas hasta trasplante), con la advertencia
  de que no identifica el cultivar ni es un calendario hidropónico. Debe pedir
  confirmar la etapa por hojas verdaderas y raíces, sin cambiarla ni cambiar la
  dosis automáticamente. A 106 días esa ventana debe dejar de aparecer.
- En cada planta compara por separado **edad desde siembra**, **etapa observada**
  y **etapa del programa del fabricante**. Cambiar los días no debe alterar una
  dosis hasta que una etapa observada/aplicable o un objetivo cambie explícitamente.
- De las 83 variedades, 70 tienen una ventana temporal publicada que puede
  aparecer como pista confirmable. En las otras 13 no se muestra una conversión
  de días a etapa; eso es intencional cuando la fuente no la respalda. La etapa
  sigue siendo seleccionable y el perfil ofrece su contexto citado cuando existe.
- Para **American Giant**, **Autumn Beauty** y el girasol genérico, registra 20
  días: aparecerá el hito de trasplante de un ensayo NFT con otro cultivar
  (‘Girassol de Jardim Amarelo Alto’), cerca de 5 cm. Confirma el tamaño y el
  desarrollo visibles; no es validación de esos cultivares ni selecciona etapa o
  EC automáticamente. A los 21 días no debe mantenerse como si fuera una ventana.

## Cobertura de las 83 variedades

En el contexto por defecto —etapa sin especificar y sistema hidropónico sin
especificar— la prueba confirma **7 identidades con evidencia directa, 57 con una
asignación explícita a evidencia de cultivo defendible y 19 sin evidencia
suficiente para un rango automático**. Esos 19 no son una categoría universal:
seis encuentran evidencia aplicable si se indica contexto: Garlic Chives,
Hon Tsai Tai, Lavender Vera, Scarlet Red Tatsoi, Tatsoi y Tulsi. Por ejemplo,
los tres cultivos de hoja requieren declarar NFT para aplicar la observación de
ese sistema; Lavender Vera, Tulsi y Garlic Chives requieren elegir una etapa que
coincida con la observación. La procedencia de cultivar y sistema sigue visible;
no se presenta como validación específica de cada cultivar.

Una auditoría de **6 etapas × 8 sistemas** para las 83 variedades encontró un
rango aplicable para **70/83** al menos en uno de esos contextos. Las 13 listadas
abajo no resuelven un rango automático en esa matriz; siguen disponibles para
receta oficial o para cálculo con objetivo explícito y calibración compatible.

La lista exacta que la prueba clasifica como **INSUFFICIENT en ese contexto por
defecto** es: Blush Hibiscus (`blush-hibiscus`), Bush Nasturtium
(`bush-nasturtium-tropaeolum-minus`), Delphinium Magic Fountains Dwarf
(`delphinium-magic-fountains-dwarf`), Epazote (`epazote`), Garlic Chives
(`garlic-chives`), Hon Tsai Tai (`hon-tsai-tai`), Hyssop (`hyssop`), Lady
Murasaki Komatsuna (`lady-murasaki-komatsuna`), Lavender Vera (`lavender-vera`),
Jolly Jester Marigold (`marigold-jolly-jester`), Mexican Tarragon
(`mexican-tarragon`), Papalo (`papalo-porophyllum-ruderale`), Rainbow Mix Coleus
(`rainbow-mix-coleus`), Scarlet Red Tatsoi (`scarlet-red-tatsoi`), Tatsoi
(`tatsoi`), Tennessee Coneflower (`tennessee-coneflower-echinacea-tennesseensis`),
Tiny Tim Sweet Alyssum (`tiny-tim-sweet-alyssum`), Tulsi / Holy Basil
(`tulsi-holy-basil-ocimum-tenuiflorum`) y Zinnia Lilliput Mixed
(`zinnia-lilliput-mixed`).

Las 83 se pueden seleccionar y usar con una receta oficial. En Por EC, Corregir y
Rellenar, la calculadora usa un rango derivado del cultivo solo cuando la etapa,
el sistema y el alcance de medición hacen aplicable la evidencia. Cuando no la
hay, el usuario puede elegir explícitamente un objetivo y el cálculo requiere
calibración medida para el producto exacto; la pantalla conserva **INSUFFICIENT**
y no inventa un rango. Algunos registros también muestran observaciones de cultivo
como referencias para elegir un objetivo manual; una observación experimental no
se convierte automáticamente en rango óptimo. No se asigna evidencia por parecido
del nombre. Esta lista describe la cobertura automática predeterminada, no impide
que una variedad opere con receta oficial o con objetivo manual y calibración
compatible.

De las 19 con evidencia insuficiente en el contexto por defecto, seis sí resuelven
evidencia en una etapa o sistema más específico. Las otras 13 que no obtienen un
rango automático en ninguna combinación probada son Blush Hibiscus, Bush
Nasturtium, Delphinium Magic Fountains Dwarf, Epazote, Hyssop, Lady Murasaki
Komatsuna, Jolly Jester Marigold, Mexican Tarragon, Papalo, Rainbow Mix Coleus,
Tennessee Coneflower, Tiny Tim Sweet Alyssum y Zinnia Lilliput Mixed. Algunas
tienen tratamientos experimentales publicados que pueden elegirse como objetivos
manuales; no son intervalos óptimos automáticos ni recomendaciones universales.

Las pruebas de cálculo usan observaciones de calibración **simuladas** para
verificar los cuatro flujos. No son datos medidos de tu FloraSeries: Por EC,
Corregir y Rellenar solo quedan calibrados para tu producto cuando guardes una
medición real con las cantidades que efectivamente añadiste. Las 83 identidades
se recorren en las pruebas con todos los modos, pero eso no significa que cada
una tenga rango automático: en estado predeterminado, 7 tienen evidencia directa,
57 usan una asignación de cultivo explícita y defendible, y 19 quedan como
INSUFFICIENT. En los contextos probados, 13 no obtienen rango automático.

Para Mexican Tarragon, [Scale & Stem](https://scaleandstem.com/plants/edible/mexican-mint-marigold/)
identifica *Tagetes lucida* y lista 0,8 mS/cm para plántula y 1,4 para crecimiento vegetativo. La página no documenta
un método experimental y ofrece cifras generales distintas en otras notas. La
calculadora muestra cada cifra como elección manual etiquetada por etapa; no crea
un rango automático ni una dosis validada.

Para Blush Hibiscus, PanAmerican Seed informa 3–4 semanas de producción de plug
para su serie *Hibiscus moscheutos* Luna F1. La calculadora muestra los días 21–28
como pista de vivero que el usuario debe confirmar observando hojas y raíces; la
fuente no identifica el cultivar Blush ni demuestra un calendario hidropónico o
un rango de EC. La variedad sigue `INSUFFICIENT` para un rango automático.

Algunas referencias recientes son condiciones observadas y seleccionables solo
como objetivo manual: los tratamientos NFT de Komatsuna, las condiciones DWC de
Tagetes patula, los valores hidropónicos de LaNiTex para marigold y los ensayos de
Dianthus, aliso dulce y zinnia en sustrato con subirrigación. Para Delphinium,
PPO/Wageningen ofrece un contexto de fertirriego bajo invernadero de 1,4 mS/cm,
pero corresponde a ‘Dark Blue/White Bee’ en maceta, no a Magic Fountains en un
depósito hidropónico; se muestra solo como opción manual. Para Zinnia elegans,
un estudio de la Universidad de Can Tho observó buen crecimiento con Hoagland-Arnon
al 50% (1,4 mS/cm) y 100% (2,8 mS/cm), pero no identifica Lilliput Mix ni establece
un óptimo; son opciones de contexto manual, no rangos automáticos. La guía de LaNiTex
es de nivel de fuente C, no identifica Jolly Jester y solo ofrece contexto por
fase; sus valores no son rangos óptimos para el depósito ni evidencia automática.
Tampoco se usan como evidencia automática las demás condiciones experimentales.
La fresa tiene elecciones manuales separadas por etapa del estudio; no se usan
para asignar la etapa de la planta ni para cambiar una receta oficial. Para Bush
Nasturtium se muestra además 1,00 mS/cm como observación manual de enraizamiento
de esquejes de *Tropaeolum majus*; la ficha es *T. minus*, así que no constituye
evidencia automática ni un objetivo validado para esa planta.
Para Monterey Strawberry, Illinois Extension documenta esa variedad en un sistema
comercial hidropónico de día neutro operado alrededor de 1,80 mS/cm. La calculadora
lo ofrece como elección manual contextual, no como óptimo ni como validación de la
formulación de nutrientes que uses. Para Hyssop, el estudio de ‘Lekar’ informa EC
de solución 2,2 ± 0,1 mS/cm durante el ensayo y trasplante a las cuatro semanas con
cuatro hojas verdaderas. La calculadora ofrece 2,2 como contexto manual y el hito
de edad como pista confirmable; no es un óptimo ni una transición automática.

Los días desde siembra son contexto, no una transición automática de etapa. Elige
la etapa que observas en cada variedad; la etapa del programa del fabricante es
independiente. Esto evita que la calculadora convierta una fecha o semana de receta
en una afirmación biológica no respaldada. Para cilantro, eneldo Bouquet y perejil
Italian Giant se muestra la referencia de un estudio NFT que trasplantó los
cultivares ensayados a las tres semanas. Un estudio de flujo profundo también
trasplantó Bouquet a las cuatro semanas, Giant of Italy a las cinco y berro a las
tres. Son observaciones de ensayos/sistemas distintos, no una edad única universal.
Bouquet no es el eneldo Fernleaf del ensayo NFT de tres semanas. Confirma el
desarrollo visible; ninguna pista cambia por sí sola la etapa ni la dosis. Para
Jolly Jester, WVU da 6–8 semanas como referencia genérica de marigold, sin identificar
Tagetes erecta o el cultivar; se muestra solo como contexto de vivero. Para
Tulsi/Holy Basil, la guía de LetPot
publica ventanas de plántula (14–21 días), crecimiento (42–56) y madurez (60–90),
además de EC distintas por fase. La calculadora muestra las dos últimas como
sugerencias con esa procedencia: a los 50 días y 75 días, comprueba la fase en la
planta y confirma manualmente. Después deben aparecer, respectivamente, los rangos
reportados de 0,90–1,20 y 1,60–2,10 mS/cm. Los días por sí solos no seleccionan
etapa ni alteran el resultado. Esta es una guía de proveedor, no una regla universal
ni una validación independiente del cultivar.

## 1. Receta y calibración de FloraSeries

1. Abre **Receta**, añade una planta, selecciona **GH FloraSeries**, el programa
   oficial **Light Feed**, **Medium Feed** o **Aggressive Feed**, la semana
   publicada y el volumen real de agua nueva. El programa del fabricante no es
   la etapa biológica de la planta.
2. Comprueba que aparezcan las cantidades separadas de **FloraMicro, FloraGro y
   FloraBloom**. Cambia el volumen y verifica que las cantidades cambien. Para la
   misma semana Grow 2, compara los tres programas: cada uno debe mostrar su
   propia dosis y rango de EC esperado por GH. Medium no publica Grow/Bloom
   weeks 10–11 en esa tabla y Aggressive no publica Grow week 1; la aplicación no
   debe interpolar esos huecos. La semana 13 debe indicar enjuague solo con agua,
   sin dosis nutritiva. Ninguna selección de programa identifica automáticamente
   la etapa biológica de la planta.
3. Para obtener una calibración real, prepara una muestra de prueba siguiendo la
   receta en un recipiente separado del sistema de las plantas. Mide el EC del agua
   **antes** y **después** de añadir y mezclar los nutrientes, espera una lectura
   estable y registra el volumen exacto. En «¿Qué obtuviste?» introduce ambas
   mediciones y las cantidades efectivamente añadidas de cada componente; edita
   cualquier dosis que haya sido distinta de la sugerida. Marca la confirmación de
   que las cantidades coinciden con lo que añadiste realmente y guarda la lectura.
   Completa el registro de medición anterior para conservar la observación fuera
   del navegador. Si cambias una dosis, el volumen de muestra o la receta, vuelve
   a confirmar antes de guardar.
4. Una observación solo ancla la estimación a la dosis y al volumen registrados.
   Para medir una respuesta en un intervalo más amplio, repite la prueba con
   **muestras nuevas e independientes**, manteniendo el mismo producto y
   formulación, la misma proporción real de componentes y el mismo volumen, pero
   usando dosis totales reales distintas. Cada muestra debe partir de agua nueva
   con su EC inicial medido; no añadas dosis sucesivas a una sola muestra para
   fabricar varios puntos. Usa volúmenes de prueba que representen el rango de tus
   depósitos. El motor resume esas lecturas como una respuesta lineal normalizada
   por volumen; no construye una curva entre dosis ni valida una curva del
   fabricante. Garden marcará como extrapolación cualquier cálculo fuera de las
   dosis o volúmenes observados. Mide después de cada dosificación; un EC coincidente
   no confirma que se haya restaurado el equilibrio de nutrientes.
5. La dosis de la receta oficial y el EC esperado por el fabricante son referencias
   diferentes del EC que acabas de medir. No sustituyas tu medición por el rango
   esperado. Si una cantidad es menor que la resolución de tu equipo, usa un
   procedimiento o instrumento adecuado antes de registrarla.

## 2. Por EC

1. Con la misma formulación y mezcla calibradas, entra en **Por EC**. Introduce el
   volumen real a preparar y el EC medido del agua de origen.
2. Revisa el rango disponible, si existe, y escribe o confirma el objetivo de EC.
   La pantalla debe mostrar dosis para los tres componentes. Una sola lectura de
   calibración es una estimación: presta atención a los avisos y vuelve a medir.
3. Cambia el objetivo y después el volumen: las cantidades deben cambiar. Vuelve a
   los valores que realmente usarás antes de preparar cualquier mezcla.
4. En una variedad con referencia general pero sin evidencia para la etapa elegida,
   por ejemplo Genovese Basil marcada como **crecimiento vegetativo**, confirma que
   la calculadora no rellena un objetivo ni afirma que el rango general aplique a esa
   etapa. Abre **Ver referencia general de EC** y, solo si decides usarla, pulsa un
   límite para convertirlo explícitamente en tu objetivo manual. Debe conservarse la
   incertidumbre y seguir exigiendo calibración compatible; no es un objetivo
   automático ni una validación específica de esa etapa.

## 3. Corregir

1. Selecciona **Corregir**. Introduce los litros que realmente quedan y el EC
   medido del tanque. Confirma el objetivo. Si la app pide confirmar la mezcla,
   hazlo solo si sabes que el tanque tiene la misma proporción real de componentes
   que la calibración elegida; la receta oficial por sí sola no demuestra esa
   proporción.
2. Si el EC está por debajo del objetivo y existe calibración aplicable, comprueba
   que aparezca una dosis parcial de nutrientes. Si está por encima y necesitas
   diluir, mide e introduce el EC del agua de reposición; revisa la capacidad.
3. Mezcla o circula, espera una lectura estable y vuelve a medir. Registra las
   cantidades efectivamente añadidas y recalcula si hace falta. El porcentaje de la
   primera dosis es una estrategia ajustable, no una garantía de resultado.

## 4. Rellenar

1. Selecciona **Rellenar**. Introduce la capacidad, los litros presentes **antes**
   del relleno, el EC medido en ese momento, el agua que piensas añadir y el EC
   medido de esa agua. Confirma el objetivo y la calibración aplicable. Si aparece
   la confirmación de mezcla, marca que el tanque corresponde a la misma proporción
   de componentes medida en esa calibración; si no conoces la mezcla, no uses esa
   estimación de nutrientes.
2. Comprueba que el resultado indique primero el agua y luego los nutrientes, si
   hacen falta. La suma debe dejar espacio para el volumen de los concentrados;
   si excede la capacidad, la aplicación debe bloquearlo y pedir que se ajuste.
   Para registrar la respuesta del nutriente, añade y mezcla primero el agua;
   mide el EC real del tanque ya rellenado antes de añadir nutrientes. Introduce
   esa lectura como EC de partida, añade la dosis, vuelve a medir y registra los
   componentes realmente añadidos. No uses el EC modelado por la app como medición.
3. Tras mezclar, mide de nuevo. Recuperar el EC no demuestra que se hayan restaurado
   las proporciones originales de nutrientes.

## 5. Sistemas con varias plantas

Añade dos o más plantas, sus cantidades y las etapas observadas. Comprueba que la
aplicación informe si las referencias disponibles se solapan, si no se solapan o si
no hay información suficiente. No debe inventar un rango común ni cambiar una
receta oficial para hacerla coincidir con las plantas. Repite con plantas de
distintas edades; una edad en días es contexto, no confirma por sí sola una etapa.
Si los rangos aplicables no se solapan, comprueba que el resultado siga diciendo
**NO_COMMON_OPTIMUM_RANGE** y que la app ofrezca, solo como opción explícita, un
punto medio operativo experimental con desviación visible por cultivo. No lo
aceptes como óptimo común ni permitas que reemplace un objetivo que ya elegiste.

## 6. Otros productos y estados

- **A+B:** identifica fabricante, producto y formulación. Para cálculo por EC registra
  una calibración real con las cantidades efectivas de ambas partes; cambiar la
  formulación no debe reutilizar silenciosamente la calibración anterior.
- **AeroGarden:** la página oficial actual de Liquid Plant Food publica grupos
  de 2/3, 6/7, 9 y 12 pods. Verifica 2/3 pods = 4 mL por alimentación; 6/7 =
  8 mL por alimentación; 9 = 8 mL en las dos primeras y 12 mL después; 12 =
  16 mL en las dos primeras y 24 mL después. El modo Receta no necesita
  volumen de depósito para estas cantidades. No pruebes un conteo intermedio no
  publicado (por ejemplo, 10 pods). Para cálculo por EC se necesita una
  calibración real compatible con el producto. [Instrucciones oficiales de
  AeroGarden](https://scottsmiraclegro.com/en-us/brands/aerogarden/products/accessories/VB999965.html).
- **Visitante e inicio de sesión:** abre la calculadora en ambos contextos y repite
  un recorrido. Comprueba que los sistemas guardados se comportan según lo que la
  interfaz indique; no presupongas sincronización entre dispositivos.
- **Almacenamiento local restringido:** en modo privado/visitante abre Mezcla
  rápida y completa al menos un cálculo sin guardar. La calculadora debe seguir
  funcionando aunque el navegador rechace leer o escribir `localStorage`; si
  guardas un sistema y el navegador lo bloquea, debe dejar la configuración
  abierta y mostrar el aviso, sin perder el cálculo actual.
- **iPhone:** revisa los cuatro modos, ES/EN, selección de plantas y teclado. Anota
  cualquier error o desbordamiento. No marques una prueba como aprobada si no
  pudiste completar el recorrido.
