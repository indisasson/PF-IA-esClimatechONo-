import DBConfig from "./DBConfig";
import pkg from 'pg'

const { Client, Pool } = pkg;
export default class Bdd {
    getNewsletters = async () => {
        let returnArray = null;
        const client = new Client (DBConfig);
        try {
            await client.connect();
            const sql = `SELECT * FROM Newsletter`;
            const result = await client.query(sql);
            await client.end();
            returnArray = result.rows;
        } catch (error) {
            console.log(error);
        }
        return returnArray;
}

}
