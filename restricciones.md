**Restricciones duras**
Cada clase se asigna exactamente una vez a un aula y a una hora de inicio. Esa hora va en la grilla de 30 min, y la clase entera tiene que entrar en su franja ese día. Es decir, empieza después de que abre la franja y termina antes de que cierre, sin pasarse a la siguiente. 
La capacidad del aula alcanza para los alumnos.
Si la clase requiere proyector, el aula lo tiene. Si requiere laboratorio, el aula es laboratorio. Las clases que no necesitan laboratorio pueden usar uno, pero se penaliza (B5).  
Un aula no puede tener clases cuyos bloques ocupados se superpongan.
Un docente no puede dictar clases cuyos bloques ocupados se superpongan, y debe estar disponible en todos los bloques que ocupa cada clase.
Una cohorte no puede tener dos clases que se superpongan. 
Un docente no supera max_min_por_dia.


**Restricciones blandas**
B1, asientos vacíos: no tiene sentido poner una clase de 20 alumnos en un aula de 200. Esta regla castiga cada asiento vacío (multiplicado por la duración de la clase). Así las aulas grandes quedan libres para las clases masivas.
B2, huecos de cohorte: si un grupo de alumnos tiene clase a las 8 y la siguiente a las 14, pasa horas esperando. Esta regla castiga cada bloque libre entre la primera y la última clase del día de una cohorte. Los alumnos quieren las clases seguidas. Es la que más pesa (100).
B3, rachas del docente: un profesor que da 6, 7 u 8 horas seguidas sin parar se agota. Esta regla castiga las horas seguidas que pasen de un límite (360 minutos, o sea tres bloques de 2 horas).
B4, días extra del docente: a un profesor le conviene ir pocos días a la facultad. Se calcula cuántos días necesita como mínimo, según el total de horas que da y su máximo diario. Cada día de más suma puntos.
B5, laboratorio sin necesitarlo: los laboratorios son pocos y escasos. Esta regla castiga que una clase común (sin computadoras) los ocupe, para dejarlos libres para las clases que sí los necesitan.
B6, días de una sola materia: si un profesor da varias materias, es mejor que las junte en el mismo día y no que venga un día por cada una. Castiga cada día en que viene solo para dar una materia. Si tiene una sola materia, esta regla no se le aplica.
