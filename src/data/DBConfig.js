import 'dotenv/config'
console.log('Estoy en entorno Node:', typeof process !== 'undefined'); // Si te imprime false, el archivo se está ejecutando del lado del navegador, lo cual no debería pasar si usás pg.
//Verificar la linea de arriba para ver el error del process

const DBConfig = {
    
    host : process.env.DB_HOST ??'',
    database : process.env.DB_DATABASE ??'',
    user : process.env.DB_USER ??'',
    password: process.env.DB_PASSWORD ??'',
    port : process.env.DB_PORT ?? 5432
    }

export default DBConfig;
