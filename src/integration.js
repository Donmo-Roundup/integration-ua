import { API_URL, TRANSLATIONS_URL, INTEGRATION_URL } from './constants'

const donationBlockElements = ['#donmo-donation-box', '#donmo-donation']

function DonmoRoundup({
  publicKey,
  orderId,
  language = 'uk',

  getExistingDonation,
  getGrandTotal,
  addDonationAction,
  removeDonationAction,

  roundupMessage,
  thankMessage,
  integrationTitle,
  errorMessage,

  isBackendBased = false,
}) {
  // -- Constants
  const shadow = document
    .getElementById('donmo-roundup')
    .attachShadow({ mode: 'open' })

  // -- Variables
  let isLoaded = false
  let currentDonation = 0.01
  let isRoundedUp = false
  let contentData = {}

  function setDonation(donationAmount) {
    currentDonation = parseFloat(donationAmount) || 0.01
    shadow.getElementById('donmo-donation').textContent =
      currentDonation.toFixed(2)
  }

  function setCurrencySymbol(currencySymbol) {
    shadow.getElementById('donmo-currency').textContent = currencySymbol
  }

  function setRoundedUp(value) {
    isRoundedUp = value
  }

  function setRoundupButtonText(message) {
    shadow.getElementById('donmo-button-text').textContent = message
  }

  function setRoundupButtonAction() {
    shadow.getElementById('donmo-roundup-button').onclick = () => {
      // If already rounded up, cancel donation on second click
      if (isRoundedUp) {
        shadow
          .getElementById('donmo-roundup-button')
          .style.setProperty('--animation-state', 'loading 2s linear infinite')

        removeDonation()
      }

      // Otherwise, create donation on click
      else {
        // Loading border animation
        shadow
          .getElementById('donmo-roundup-button')
          .style.setProperty('--animation-state', 'loading 2s linear infinite')

        createDonation().finally(() =>
          // Disable loading animation
          shadow
            .getElementById('donmo-roundup-button')
            .style.setProperty('--animation-state', 'none')
        )
      }
    }
  }

  function disableRoundupButton() {
    shadow.getElementById('donmo-roundup-button').disabled = true
  }

  function enableRoundupButton() {
    shadow.getElementById('donmo-roundup-button').disabled = false
  }

  function clearView() {
    setRoundupButtonText(contentData.roundupMessage)

    shadow
      .getElementById('donmo-button-checkmark')
      .style.setProperty('--check-animation', 'none')

    shadow
      .getElementById('donmo-donation-checkmark')
      .style.setProperty('--check-animation', 'none')

    donationBlockElements.forEach((id) => {
      shadow.querySelector(id).style = `
                    background-color: transparent;
                    color: #000;
                    `
    })
    shadow.getElementById('donmo-roundup-button').style = 'cursor: pointer;'
    shadow.getElementById('donmo-roundup-button').removeAttribute('title')

    shadow.getElementById('donmo-roundup-button').disabled = false
  }

  function setErrorView() {
    // Show error
    setRoundupButtonText(contentData.errorMessage)

    // Go back to normal view in 2.5s
    setTimeout(() => {
      clearView()
      setDonation(currentDonation)
    }, 2500)
  }

  function setSuccessRoundupView() {
    // Set checkmarks after donation is created
    shadow
      .getElementById('donmo-button-checkmark')
      .style.setProperty('--check-animation', 'checkmark 0.7s forwards')

    shadow
      .getElementById('donmo-donation-checkmark')
      .style.setProperty('--check-animation', 'checkmark 0.7s forwards')

    // Set green input after donation is created
    donationBlockElements.forEach((id) => {
      shadow.querySelector(id).style = `
         background-color: #c7f5eb;
         color: #0e8161;
         `
    })

    // Set thank you message
    setRoundupButtonText(contentData.thankMessage)

    shadow.getElementById('donmo-roundup-button').title =
      contentData.cancelDonationMessage
  }

  async function setContentData(customData) {
    // fetch default data for given language
    const translationsResponse = await fetch(TRANSLATIONS_URL)
    const translations = await translationsResponse.json()

    contentData = translations[language]
    // fill content data with custom data
    for (const key in contentData) {
      if (customData[key]) {
        contentData[key] = customData[key]
      }
    }
  }

  function setContent() {
    shadow.getElementById('contribution-message').innerText =
      contentData.contributionMessage

    shadow.getElementById('funds-title').innerText = contentData.funds.title

    shadow.getElementById('prytula-fund-logo').title =
      contentData.funds.prytulaFund

    shadow.getElementById('come-back-alive-logo').title =
      contentData.funds.comeBackAlive

    shadow.getElementById('united24-logo').title = contentData.funds.united24

    shadow.getElementById('with-love-message').innerText = contentData.withLove

    shadow.getElementById('donmo-roundup-heading').innerText =
      contentData.integrationTitle
  }

  // Donations operations

  async function calculateDonation(orderAmount) {
    const res = await fetch(`${API_URL}/calculate?orderAmount=${orderAmount}`, {
      headers: {
        pk: publicKey,
      },
    })
    const data = await res.json() // {donationAmount, currencySymbol}

    return data
  }

  async function checkDonationAmount() {
    // Fetch (possibly) existing donation by orderId
    const donationResponse = await fetch(`${API_URL}/check/${orderId}`, {
      headers: {
        pk: publicKey,
      },
    })
    const {
      data: { donationAmount },
    } = await donationResponse.json()
    return donationAmount || null
  }

  async function createDonation() {
    try {
      const donationDoc = {
        donationAmount: currentDonation,
        orderId,
      }

      // If not backend-based, create donation on a fly
      if (!isBackendBased) {
        // Create donation request
        const result = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            pk: publicKey,
          },
          body: JSON.stringify(donationDoc),
        })
        const response = await result.json()

        if (!response || response.status !== 200) throw Error
      }

      // Call addDonation callback provided by the store
      await addDonationAction(donationDoc)

      setRoundedUp(true)
      setSuccessRoundupView()
    } catch (err) {
      setErrorView()
    }
  }

  async function removeDonation() {
    try {
      // Cancel donation on a fly if not backend-based
      if (!isBackendBased) {
        const result = await fetch(`${API_URL}/cancel/${orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            pk: publicKey,
          },
        })

        const response = await result.json()
        if (!response || response.status == 500) throw Error
      }

      await removeDonationAction()

      setRoundedUp(false)
      clearView()
    } catch (err) {
      setErrorView()
    }
  }

  // Integration logic

  async function syncWithDonmoBackend() {
    disableRoundupButton()
    const existingDonation = getExistingDonation() || 0
    const backendDonation = await checkDonationAmount()

    // Improbable but possible discrepancy fix

    // existingDonation is empty but backendDonation exists => remove backendDonation
    if (!existingDonation && backendDonation) {
      removeDonation()
    }

    // existingDonation exists but is different from backendDonation => create (and replace) backendDonation
    if (existingDonation && existingDonation !== backendDonation) {
      setDonation(existingDonation)
      createDonation()
    }
    enableRoundupButton()
  }

  // triggered on first load and every grandTotal change
  async function refresh() {
    if (isLoaded) {
      const existingDonation = getExistingDonation() || 0
      const orderAmount = getGrandTotal()

      if (!existingDonation) {
        const { donationAmount: calculatedDonation, currencySymbol } =
          await calculateDonation(orderAmount)
        setDonation(calculatedDonation)
        setCurrencySymbol(currencySymbol)
        setRoundedUp(false)
      }

      if (existingDonation) {
        const { donationAmount: calculatedDonation, currencySymbol } =
          await calculateDonation(orderAmount - existingDonation)

        // Compare if the existing donation is the right one or needs to be recalculated

        // If yes - it's already rounded up successfully
        if (calculatedDonation === existingDonation) {
          setDonation(existingDonation)
          setCurrencySymbol(currencySymbol)
          setSuccessRoundupView()
          setRoundedUp(true)
        }
        // If no - clean the existing donation and propose the new one
        else {
          await removeDonation()
          setDonation(calculatedDonation)
        }
      }

      if (!isBackendBased) {
        // Resolve backend discrepancy if there is such one (improbable but important)
        await syncWithDonmoBackend()
      }
    }
  }

  async function build() {
    const response = await fetch(INTEGRATION_URL)

    const html = await response.text()

    const contentNode = document.createElement('div')
    contentNode.insertAdjacentHTML('beforeend', html)
    shadow.appendChild(contentNode)

    await setContentData({
      roundupMessage,
      thankMessage,
      integrationTitle,
      errorMessage,
    })

    setContent()

    setDonation(0.01)

    setRoundupButtonText(contentData.roundupMessage)
    setRoundupButtonAction()

    // Adjust the integration width on start and every next resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const width = entry.contentBoxSize[0].inlineSize
          // trigger on change of integration width
          if (width) {
            responsiveResize(shadow)
          }
        }
      }
    })

    resizeObserver.observe(shadow.getElementById('integration'))

    isLoaded = true

    await refresh()
  }

  return { build, refresh }
}

function responsiveResize(shadow) {
  const width = shadow.getElementById('integration').scrollWidth

  if (width < 310) {
    shadow.getElementById('logos').style = `flex-wrap: wrap;`
    shadow.querySelector('h4').style = 'white-space: unset;'
  } else {
    shadow.getElementById('logos').style = `flex-wrap: nowrap;`
    shadow.querySelector('h4').style = 'white-space: nowrap;'
  }

  // Align lables and content horizontally
  if (width > 400) {
    shadow
      .querySelectorAll('#donmo-donation-wrapper, #donmo-funds')
      .forEach((el) => {
        el.style = `
      flex-direction: row;
      align-items: center;
      gap: 15px;`
      })
  } else {
    shadow
      .querySelectorAll('#donmo-funds, #donmo-donation-wrapper')
      .forEach((el) => (el.style = 'flex-direction: column;'))
  }

  // Align content horizontally but leave roundup button below
  if (width > 740) {
    shadow.getElementById('donmo-content').style = `
    flex-direction: row;
    gap: 40px;
    `
  } else {
    shadow.getElementById('donmo-content').style = `flex-direction: column;`
  }

  // Align integration horizontally including the roundup button
  if (width > 1000) {
    shadow.querySelector('#integration main').style = `
    display: flex;
    align-items: center;
    gap: 40px;
    `

    shadow.getElementById('donmo-content').style.flexBasis = '60%'
    shadow.getElementById('donmo-content').style.marginBottom = '0'
  } else {
    shadow.querySelector('#integration main').style = `display: block;`
    shadow.getElementById('donmo-content').style.marginBottom = '1.3em'
  }
}

export default DonmoRoundup
