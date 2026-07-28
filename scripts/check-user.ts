import mysql from 'mysql2/promise'

async function checkUser() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3310'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'rootpassword123',
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
  })

  console.log('Connected to MySQL database...')
  
  const [rows] = await connection.query(
    'SELECT id, name, email, email_verified, role, created_at FROM user WHERE email = ?',
    ['bhaarat2050@gmail.com']
  )

  console.log('Query result for bhaarat2050@gmail.com:')
  console.log(JSON.stringify(rows, null, 2))

  if ((rows as any[]).length === 0) {
    console.log('Searching for any user matching %bhaarat%...')
    const [allRows] = await connection.query(
      'SELECT id, name, email, email_verified, role, created_at FROM user WHERE email LIKE ? OR name LIKE ?',
      ['%bhaarat%', '%bhaarat%']
    )
    console.log(JSON.stringify(allRows, null, 2))
  }

  await connection.end()
}

checkUser().catch(console.error)
