# Historias de Usuario

Las siguientes historias pertenecen a los periles que utilizaran este sistema de gestion que se implementara en este establecimiento. El perfil incluye las funciones de gestión y seguimiento académico del establecimiento.

## Control de asistencia 

### HU1 - INSPECTOR
Yo como profesor, quiero marcar a cada estudiante como presente, ausente o con justificativo, para tener un registro detallado de su estado.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
Estados permitidos: Presente / Ausente / Justificado. Estado editable por el inspector hasta las 23:59 del mismo día escolar. El estado "Justificado" requiere de forma obligatoria una observación escrita o la selección de un motivo predefinido.  

### HU2 - APODERADO
Yo como apoderado, quiero ver el registro de asistencia de mi pupilo(a) por mes y asignatura en la misma plataforma compartida, para estar informado oportunamente sobre sus inasistencias. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
Solo puede ver la asistencia de su propio pupilo. Vista de solo lectura. Muestra el porcentaje (%) de asistencia en tiempo real. Permite filtrar cronológicamente por mes. 

### HU3 - DOCENTE
Yo como docente, quiero poder visualizar el registro de los alumnos de los cursos de los que imparto clases, ademas de poder obtener un resumen de este mismo. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Solo poder la asistencia no modificarla. Vista actual de la asistencia del dia.

### HU4 - DIRECTOR/UTP 
Yo como Director/UTP, quiero verificar la inasistencia de un alumno directamente en el sistema e intervenir en el estado visual, para regularizar su situación académica ante el MINEDUC de forma centralizada. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
El Director/UTP puede verificar el estado "Ausente" a "Justificado" en cualquier fecha retroactiva del año escolar vigente. Debe registrar el motivo de la justificación (ej. Licencia médica, problema familiar). El cambio debe recalcular automáticamente el porcentaje de asistencia del alumno si el método del colegio lo solicita.

### HU5 - DIRECTOR/UTP 
Yo como Director/UTP, quiero visualizar un reporte de inasistencias reiteradas por curso, para identificar estudiantes en riesgo de deserción escolar e intervenir a tiempo. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
Umbral configurable (por defecto ≥3 ausencias seguidas). Filtro por curso y período académico. Acceso irrestricto a todos los cursos del establecimiento. 

## Gestión de Calificaciones

### HU1 - PROFESOR 
Yo como profesor, quiero registrar las calificaciones de cada estudiante por asignatura y periodo, para mantener un historial centralizado y evitar el cálculo 
manual de promedios. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
Registro de notas en escala 2.0 a 7.0 (con un decimal). Cálculo automático del promedio por asignatura y semestre. El sistema recalcula el promedio general al 
guardar cada nota. No se permite ingresar notas fuera del rango permitido. 

### HU2 - APODERADO 
Yo como apoderado, quiero visualizar las calificaciones de mi pupilo(a) por asignatura y semestre, para poder acompañar su desempeño académico de forma oportuna. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
Solo puede ver las calificaciones de su propio pupilo (restricción por ID de filiación). Vista de solo lectura. Muestra el promedio por asignatura y el promedio general. Historial disponible por semestre. 

### HU3 - DIRECTOR/UTP 
Yo como Director/UTP, quiero recibir alertas automáticas cuando el promedio de un estudiante caiga bajo 4.0, para intervenir académicamente a tiempo. 

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN: 
El sistema evalúa el promedio tras cada actualización de nota. Si el promedio de una asignatura o el promedio general es menor a 4.0, se genera una alerta automática. La alerta queda visible en el dashboard del Director/UTP y del docente correspondiente. 

## Repositorio de Material

### HU1 - PROFESOR
Yo como profesor, quiero subir materiales pedagógicos en distintos formatos y asociarlos a un curso y área, para que estén disponibles de forma organizada para mis estudiantes.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Formatos permitidos: PDF, Word, imágenes, videos. Selección obligatoria de curso y área (lenguaje, matemáticas, etc.). Tamaño máximo de archivo configurable. Confirmación visual al completar la carga.

### HU2 - APODERADO
Yo como apoderado, quiero ver y descargar los materiales publicados por curso y área, para acceder al contenido pedagógico desde cualquier dispositivo.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Solo visualiza materiales del curso al que pertenece el estudiante. Vista de solo lectura con opción de descarga. Permite filtrar por área y por fecha de publicación.

### HU3 - PROFESOR
Yo como profesor, quiero editar o eliminar materiales previamente publicados, para mantener el repositorio actualizado y sin contenido obsoleto.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Solo el profesor autor del material (o el administrador) puede editar o eliminar. La eliminación requiere confirmación. Se mantiene un registro (log) de la acción realizada.

## Sistema de Alertas

### HU1 - SISTEMA (automático)
Yo como sistema, generare alertas automáticas por bajo rendimiento académico o inasistencia reiterada, para notificar oportunamente al docente y apoderado correspondiente.

#### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Clasificación de alerta en tres niveles: Crítico, Riesgo, Normal. Se genera al detectar promedio < 4.0 o inasistencia reiterada (umbral configurable). Notificación inmediata a docente y apoderado del estudiante.

### HU2 - DOCENTE
Yo como docente, quiero recibir y visualizar las alertas de mis estudiantes en un listado centralizado, para priorizar intervenciones pedagógicas.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Muestra solo alertas de los cursos que dicta el docente. Permite marcar una alerta como "En seguimiento" o "Resuelta". Ordenamiento por nivel de criticidad.

### HU3 - APODERADO
Yo como apoderado, quiero recibir una notificación inmediata cuando se genere una alerta sobre mi pupilo(a), para intervenir tempranamente desde el hogar.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Notificación push o email al momento de generarse la alerta. Incluye tipo de alerta (académica/asistencia), nivel y motivo. Enlace directo al detalle del estudiante en el sistema.

### HU4 - DIRECTOR/UTP
Yo como Director/UTP, quiero visualizar un panel consolidado de todas las alertas activas del establecimiento, para priorizar la gestión institucional de casos críticos.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Acceso irrestricto a alertas de todos los cursos. Filtro por nivel (Crítico/Riesgo/Normal), curso y estado de seguimiento. Exportación del listado en formato descargable.

## Dashboard de Monitoreo

### HU1 - APODERADO
Yo como apoderado, quiero ver un panel resumen con el semáforo académico de mi pupilo(a), para conocer de un vistazo su situación general.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Semáforo con tres estados: Verde (normal), Amarillo (riesgo), Rojo (crítico), calculado en base a promedio y asistencia. Muestra alertas activas y progreso académico resumido. Actualización en tiempo real.

### HU2 - DOCENTE
Yo como docente, quiero ver un panel con el estado completo de mi curso, incluyendo estudiantes en riesgo y estadísticas generales, para orientar mi trabajo pedagógico diario.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Muestra listado de estudiantes con su semáforo individual. Destaca estudiantes en estado Rojo/Amarillo al inicio del listado. Incluye estadísticas del curso: promedio general, % asistencia promedio.

### HU3 - DIRECTOR/UTP
Yo como Director/UTP, quiero ver un dashboard institucional con indicadores generales de todos los cursos, para tomar decisiones estratégicas informadas.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Acceso irrestricto a todos los cursos. Muestra distribución de estudiantes por semáforo (Verde/Amarillo/Rojo) a nivel institucional. Permite filtrar por curso, nivel y periodo.

### HU4 - APODERADO
Yo como apoderado, quiero ver la evolución histórica del semáforo académico de mi pupilo(a) a lo largo del año, para identificar tendencias de mejora o deterioro.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Gráfico de línea de tiempo con el estado del semáforo por mes. Permite seleccionar el periodo a visualizar (semestre/año). Incluye eventos relevantes (alertas generadas) marcados en la línea de tiempo.

## Gestión de Roles, Acceso, Seguridad y Privacidad

### HU1 - ADMINISTRADOR
Yo como administrador, quiero crear y gestionar cuentas de usuario asignando el rol correspondiente (Docente, Apoderado, Estudiante, Administrador), para controlar el acceso al sistema según la RBAC definida.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Roles disponibles: ESTUDIANTE, DOCENTE, APODERADO, ADMIN. Un usuario solo puede tener un rol activo a la vez. Contraseña temporal generada automáticamente en la creación. Registro en log de toda creación/modificación de cuenta.

### HU2 - ADMINISTRADOR
Yo como administrador, quiero que toda la comunicación e información almacenada esté cifrada, para cumplir con la Ley Nº 19.628 y la Ley Nº 21.696 de Protección de Datos Personales.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Cifrado en tránsito mediante HTTPS/TLS en todas las conexiones. Cifrado en reposo de datos sensibles en la base de datos. Cumplimiento con el principio de responsabilidad demostrada exigido por la Ley Nº 21.696.

### HU3 - APODERADO
Yo como apoderado, quiero otorgar mi consentimiento informado antes de que los datos de mi pupilo(a) sean utilizados en el sistema, para asegurar el cumplimiento del piloto con la normativa de protección de datos.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
El consentimiento se solicita antes del primer acceso del apoderado al sistema. Debe quedar registrado con fecha y versión del documento aceptado. El acceso al sistema queda bloqueado hasta otorgar el consentimiento.

### HU4 - ADMINISTRADOR
Yo como administrador, quiero consultar la trazabilidad completa de acciones realizadas en el sistema, para auditar accesos y cambios ante eventuales incidentes de seguridad.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Registro de logs por cada acción relevante: creación, edición, eliminación y accesos. Los logs incluyen usuario, rol, acción, fecha/hora e IP de origen. Los logs no pueden ser modificados ni eliminados por ningún usuario.

## Funcionalidades Complementarias

### HU1 - DOCENTE/DIRECTOR/UTP
Yo como docente o Director/UTP, quiero generar reportes de asistencia, calificaciones y alertas en formato descargable, para presentar información consolidada en reuniones o ante el MINEDUC.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Reportes disponibles: asistencia, calificaciones y alertas. Exportación en al menos un formato descargable (PDF o Excel). Permite filtrar por curso, asignatura y rango de fechas antes de generar el reporte.

### HU2 - ESTUDIANTE/APODERADO/DOCENTE
Yo como usuario del sistema, quiero acceder a SIGA desde un dispositivo móvil con una interfaz responsiva, para consultar información sin depender de un computador.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
La interfaz se adapta correctamente a pantallas de smartphone y tablet. Todas las funcionalidades principales (asistencia, calificaciones, alertas, materiales) están disponibles en la versión móvil. Tiempo de carga aceptable en conexiones de baja velocidad, típicas del contexto rural.

### HU3 - DIRECTOR/UTP
Yo como Director/UTP, quiero acceder a análisis de datos con métricas de engagement y patrones de evolución de notas, para fundamentar decisiones estratégicas con evidencia.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Métricas disponibles: frecuencia de uso por rol, evolución de promedios en el tiempo, patrones de inasistencia. Visualización mediante gráficos interactivos. Permite exportar los datos analizados.

### HU4 - ESTUDIANTE/APODERADO/DOCENTE
Yo como usuario del sistema, quiero contar con un calendario académico integrado, para visualizar fechas relevantes del año escolar sin depender de comunicados externos.

### CRITERIOS DE ACEPTACIÓN / VALIDACIÓN:
Muestra eventos institucionales (evaluaciones, reuniones, vacaciones) según el calendario oficial del establecimiento. Cada rol visualiza los eventos relevantes a su curso o función. El administrador puede crear, editar y eliminar eventos.

