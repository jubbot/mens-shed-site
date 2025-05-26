export default async function handler(req, res) {
  const signedRequest = req.body.signed_request

  if (!signedRequest) {
    return res.status(400).send('Missing signed_request')
  }

  // Optional: verify signature if needed

  // You could decode it and log which user removed the app
  // Then mark them inactive in Sanity

  console.log('User deauthorized:', signedRequest)

  res.status(200).send('OK')
}
