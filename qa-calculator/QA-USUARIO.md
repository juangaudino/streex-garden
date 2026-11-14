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

## 1. Receta y calibración de FloraSeries

1. Abre **Receta**, añade una planta, selecciona **GH FloraSeries**, una etapa de
   su programa y el volumen real de agua nueva.
2. Comprueba que aparezcan las cantidades separadas de **FloraMicro, FloraGro y
   FloraBloom**. Cambia el volumen y verifica que las cantidades cambien; cambia
   la etapa del programa y comprueba que cambie la receta. La etapa del programa
   no identifica automáticamente la etapa biológica de la planta.
3. Para obtener una calibración real, prepara una muestra siguiendo la receta y
   mide su EC **antes** y **después** de añadir y mezclar los nutrientes. Espera a
   que la lectura se estabilice. En «¿Qué obtuviste?» introduce ambas mediciones y
   las cantidades efectivamente añadidas de cada componente; edita cualquier dosis
   que haya sido distinta de la sugerida. Guarda la lectura.
4. La dosis de la receta oficial y el EC esperado por el fabricante son referencias
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

## 3. Corregir

1. Selecciona **Corregir**. Introduce los litros que realmente quedan y el EC
   medido del tanque. Confirma el objetivo.
2. Si el EC está por debajo del objetivo y existe calibración aplicable, comprueba
   que aparezca una dosis parcial de nutrientes. Si está por encima y necesitas
   diluir, mide e introduce el EC del agua de reposición; revisa la capacidad.
3. Mezcla o circula, espera una lectura estable y vuelve a medir. Registra las
   cantidades efectivamente añadidas y recalcula si hace falta. El porcentaje de la
   primera dosis es una estrategia ajustable, no una garantía de resultado.

## 4. Rellenar

1. Selecciona **Rellenar**. Introduce la capacidad, los litros presentes **antes**
   del relleno, el EC medido en ese momento, el agua que piensas añadir y el EC
   medido de esa agua. Confirma el objetivo y la calibración aplicable.
2. Comprueba que el resultado indique primero el agua y luego los nutrientes, si
   hacen falta. La suma debe dejar espacio para el volumen de los concentrados;
   si excede la capacidad, la aplicación debe bloquearlo y pedir que se ajuste.
3. Tras mezclar, mide de nuevo. Recuperar el EC no demuestra que se hayan restaurado
   las proporciones originales de nutrientes.

## 5. Sistemas con varias plantas

Añade dos o más plantas, sus cantidades y las etapas observadas. Comprueba que la
aplicación informe si las referencias disponibles se solapan, si no se solapan o si
no hay información suficiente. No debe inventar un rango común ni cambiar una
receta oficial para hacerla coincidir con las plantas. Repite con plantas de
distintas edades; una edad en días es contexto, no confirma por sí sola una etapa.

## 6. Otros productos y estados

- **A+B:** identifica fabricante, producto y formulación. Para cálculo por EC registra
  una calibración real con las cantidades efectivas de ambas partes; cambiar la
  formulación no debe reutilizar silenciosamente la calibración anterior.
- **AeroGarden:** verifica Receta con un grupo de 6, 7 o 9 pods y la alimentación
  correspondiente. Los demás grupos no deben recibir cantidades interpoladas. Para
  cálculo por EC se necesita una calibración real compatible con el producto.
- **Visitante e inicio de sesión:** abre la calculadora en ambos contextos y repite
  un recorrido. Comprueba que los sistemas guardados se comportan según lo que la
  interfaz indique; no presupongas sincronización entre dispositivos.
- **iPhone:** revisa los cuatro modos, ES/EN, selección de plantas y teclado. Anota
  cualquier error o desbordamiento. No marques una prueba como aprobada si no
  pudiste completar el recorrido.
