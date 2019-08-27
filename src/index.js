let pcsclite = require("pcsclite")
let iconv = require("iconv-lite")
let { SELECT, THAI_ID_CARD, VERSION, GET_RESPONSE, CARDS } = require("./adpu")

let pcsc = pcsclite()

pcsc.on("reader", function(reader) {
  reader.on("error", function(err) {
    console.log("Error(", this.name, "):", err.message)
  })

  reader.on("status", function(status) {
    // console.log("Status(", this.name, "):", status)
    /* check what has changed */
    let changes = this.state ^ status.state
    if (changes) {
      if (
        changes & this.SCARD_STATE_EMPTY &&
        status.state & this.SCARD_STATE_EMPTY
      ) {
        console.log("card removed") /* card removed */
        reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
          if (err) {
            console.log(err)
          }
        })
      } else if (
        changes & this.SCARD_STATE_PRESENT &&
        status.state & this.SCARD_STATE_PRESENT
      ) {
        console.log("card inserted") /* card inserted */

        setTimeout(() => {
          reader.connect({ share_mode: this.SCARD_SHARE_SHARED }, function(
            err,
            protocol
          ) {
            if (err) {
              console.log(err)
            } else {
              // console.log("Protocol(", reader.name, "):", protocol)
              readData(reader, protocol)
            }
          })
        }, 1000)
      }
    }
  })

  reader.on("end", function() {
    console.log("Reader", this.name, "removed")
  })
})

pcsc.on("error", function(err) {
  console.log("PCSC error", err.message)
})

const readData = async (reader, protocol) => {
  await transmit(reader, SELECT.concat(THAI_ID_CARD), protocol)
  let data = {}
  const version = await sendCommand(reader, VERSION, protocol)
  const card = CARDS[version]
  for (let field in card) {
    data[field] = await sendCommand(reader, card[field], protocol)
  }
  console.log(data)
}

const sendCommand = async (reader, command, protocol) => {
  await transmit(reader, command, protocol)
  const data = await transmit(
    reader,
    GET_RESPONSE.concat(command[command.length - 1]),
    protocol
  )
  return iconv
    .decode(data, "tis620")
    .slice(0, -2)
    .trim()
  // .replace(/#/g, " ")
}

const transmit = async (reader, command, protocol) => {
  return new Promise((resolve, reject) => {
    reader.transmit(Buffer.from(command), 256, protocol, function(err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
