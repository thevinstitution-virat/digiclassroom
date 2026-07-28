const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'digiclassroom_user',
        password: 'digiclassroom123',
        database: 'virat_gyankosh'
    });

    try {
        const [rows] = await connection.execute('DESCRIBE enhanced_user_profiles');
        console.log(rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

run();
