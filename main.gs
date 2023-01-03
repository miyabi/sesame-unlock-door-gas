function main() {
}

function test() {
}

function doPost(e) {
  const { command, history, apiKey, qrCode } = JSON.parse(e.postData.contents)
  const sesameData = decodeQrCode(qrCode)
  const result = execute(config.commands[command], history ?? config.defaultHistory, apiKey, sesameData)

  const output = ContentService.createTextOutput()
  output.setMimeType(ContentService.MimeType.TEXT)
  output.setContent(result)
  return output;
}

function execute(command, history, apiKey, sesameData) {
  try {
    const { uuid, secKey } = sesameData
    const sign = generateCmacSign(secKey)

    const payload = {
      cmd: command,
      history: Utilities.base64Encode(history, Utilities.Charset.UTF_8),
      sign,
    }

    const params = {
      headers:{
        'x-api-key': apiKey,
      },
      method: 'POST',
      payload: JSON.stringify(payload),
    }

    const url = `${config.apiUrl}/${uuid}/cmd`

    const response = UrlFetchApp.fetch(url, params)
    const responseCode = response.getResponseCode()
    const contentText = response.getContentText()
    console.log(`${responseCode} ${contentText}`)

    if (responseCode === 200) {
      return 'SUCCEEDED'
    } else {
      return contentText
    }
  } catch (error) {
    console.log(error)
    return error.message
  }
}

function generateCmacSign(secKey) {
  const now = Math.floor(Date.now() / 1000)

  const dataView = new DataView(new ArrayBuffer(4))
  dataView.setUint32(0, now, true)

  const message = dataView.getUint32(0).toString(16).slice(2, 8)

  const { CryptoJS } = CryptojsExtension
  const { Hex } = CryptoJS.enc
  return CryptoJS.CMAC(Hex.parse(secKey), Hex.parse(message)).toString()
}

function decodeQrCode(qrCode) {
  const matches = decodeURIComponent(qrCode).match(/^ssm:\/\/UI\?(.*)$/)
  if (!matches) {
    return null
  }

  const params = matches[1]
    .split('&')
    .reduce((accumulator, _) => {
      const [key, value] = _.split('=', 2)
      accumulator[key] = value
      return accumulator
    }, {})

  const { sk, n } = params
  const uuid = `${toHex(sk, 83, 86)}-${toHex(sk, 87, 88)}-${toHex(sk, 89, 90)}-${toHex(sk, 91, 92)}-${toHex(sk, 93, 98)}`
  const secKey = toHex(sk, 1, 16)

  return { uuid, secKey, name: n }
}

function toHex(src, start, end) {
  return Utilities.base64Decode(src)
    .slice(start, end + 1)
    .map(_ => (_ + 256).toString(16).slice(-2))
    .join('')
}
