/*
 * prerequisites
 */
if (!process.env.NETLIFY) {
  // get local env vars if not in CI
  // if in CI i expect its already set via the UI
  require('dotenv').config();
}
// required env vars
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error('no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set');
if (!process.env.GOOGLE_PRIVATE_KEY)
  throw new Error('no GOOGLE_PRIVATE_KEY env var set');
if (!process.env.GOOGLE_SPREADSHEET_ID_FROM_URL)
  // spreadsheet key is the long id in the sheets URL
  throw new Error('no GOOGLE_SPREADSHEET_ID_FROM_URL env var set');

/*
 * ok real work
 *
 * the library also allows working just with cells,
 * but this example only shows editing rows since thats more common
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');

exports.handler = async (event, context) => {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID_FROM_URL);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  });
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0]; // you may want to customize this
  // const headers = await sheet.loadHeaderRow();
  console.log('accessing', sheet.title, 'it has ', sheet.rowCount, ' rows');
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '');
  const segments = path.split('/').filter((e) => e);
  try {
    switch (event.httpMethod) {
      case 'GET':
        /* GET /.netlify/functions/google-spreadsheet-fn */
        if (segments.length === 0) {
          const rows = await sheet.getRows(); // can pass in { limit, offset }
          let serializedRows = [];
          rows.forEach((row) => {
            let temp = {};
            sheet.headerValues.map((header) => {
              temp[header] = row[header];
            });
            serializedRows.push(temp);
          });
          return {
            statusCode: 200,
            // body: JSON.stringify({rows}) // dont do this - has circular references
            body: JSON.stringify(serializedRows) // better
          };
        }
        /* GET /.netlify/functions/google-spreadsheet-fn/123456 */
        if (segments.length === 1) {
          const rowId = segments[0];
          const rows = await sheet.getRows(); // can pass in { limit, offset }
          return {
            statusCode: 200,
            body: JSON.stringify(rows[rowId]) // just sends less data over the wire
          };
        } else {
          return {
            statusCode: 500,
            body:
              'too many segments in GET request - you should only call somehting like /.netlify/functions/google-spreadsheet-fn/123456 not /.netlify/functions/google-spreadsheet-fn/123456/789/101112'
          };
        }
      /* POST /.netlify/functions/google-spreadsheet-fn */
      case 'POST':
        /* parse the string body into a useable JS object */
        const data = JSON.parse(event.body);
        console.log('`POST` invoked', data);
        const addedRow = await sheet.addRow(data);
        console.log({ addedRow });
        return {
          statusCode: 200,
          body: JSON.stringify({ message: `POST Success` })
        };
      /* PUT /.netlify/functions/google-spreadsheet-fn/123456 */
      case 'PUT':
        /* PUT /.netlify/functions/google-spreadsheet-fn */
        if (segments.length === 0) {
          console.error('PUT request must also have an id'); // we could allow mass-updating of the sheet, but nah
          return {
            statusCode: 422, // unprocessable entity https://stackoverflow.com/questions/3050518/what-http-status-response-code-should-i-use-if-the-request-is-missing-a-required
            body: 'PUT request must also have an id.'
          };
        }
        /* PUT /.netlify/functions/google-spreadsheet-fn/123456 */
        if (segments.length === 1) {
          const rowId = segments[0];
          const rows = await sheet.getRows(); // can pass in { limit, offset }
          const data = JSON.parse(event.body);
          console.log(`PUT invoked on row ${rowId}`, data);
          rows[rowId] = data;
          await rows[rowId].save(); // save updates
          return {
            statusCode: 200,
            body: 'PUT is a success!'
            // body: JSON.stringify(rows[rowId]) // just sends less data over the wire
          };
        } else {
          return {
            statusCode: 500,
            body:
              'too many segments in PUT request - you should only call somehting like /.netlify/functions/google-spreadsheet-fn/123456 not /.netlify/functions/google-spreadsheet-fn/123456/789/101112'
          };
        }
      /* DELETE /.netlify/functions/google-spreadsheet-fn/123456 */
      case 'DELETE':
        if (segments.length === 1) {
          const rowId = segments[0];
          const rows = await sheet.getRows(); // can pass in { limit, offset }
          await rows[rowId].delete(); // delete a row
          return {
            statusCode: 200,
            body: 'DELETE is a success!'
          };
        } else {
          return {
            statusCode: 500,
            body:
              'invalid segments in DELETE request, must be /.netlify/functions/google-spreadsheet-fn/123456'
          };
        }
      /* Fallthrough case */
      default:
        return {
          statusCode: 500,
          body: 'unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE'
        };
    }
  } catch (err) {
    console.error('error ocurred in processing ', event);
    console.error(err);
    return {
      statusCode: 500,
      body: err
    };
  }
};

// exports.handler = async (event, context) => {
//   try {
//     const subject = event.queryStringParameters.name || 'World';
//     return {
//       statusCode: 200,
//       body: JSON.stringify({ message: `Hello ${subject}` })
//       // // more keys you can return:
//       // headers: { "headerName": "headerValue", ... },
//       // isBase64Encoded: true,
//     };
//   } catch (err) {
//     return { statusCode: 500, body: err.toString() };
//   }
// };
