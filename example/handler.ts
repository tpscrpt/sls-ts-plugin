/* eslint-disable @typescript-eslint/no-unused-vars */
import * as _ from 'lodash'

// modern module syntax
const hello = async (event, context, callback): Promise<any> => {

  // dependencies work as expected
  console.log(_.VERSION)

  // async/await also works out of the box
  await new Promise((resolve, reject) => setTimeout(resolve, 500))

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  }

  callback(null, response)
}

export default hello