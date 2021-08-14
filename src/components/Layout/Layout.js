import React from "react"
import { Global, css, keyframes } from "@emotion/react"
import styled from "@emotion/styled"

import { navigate } from "gatsby"

import { client } from "../../context/ApolloContext"
import StoreContext, { defaultStoreContext } from "../../context/StoreContext"
import UserContext, { defaultUserContext } from "../../context/UserContext"
import InterfaceContext, {
  defaultInterfaceContext,
} from "../../context/InterfaceContext"

import Header from "./Header"
import ContributorArea from "../ContributorArea"
import PageContent from "./PageContent"
import ProductImagesBrowser from "../ProductPage/ProductImagesBrowser"
import Cart from "../Cart"
import SiteMetadata from "../shared/SiteMetadata"

import { logout, getUserInfo } from "../../utils/auth"
import {
  breakpoints,
  colors,
  fonts,
  fontWeights,
  gradients,
  lineHeights,
  zIndices,
} from "../../utils/styles"

import gql from "graphql-tag"

const globalStyles = css`
  @font-face {
    font-weight: 100 900;
    font-family: "Inter var";
    font-style: normal;
    src: url("/fonts/Inter-roman.var.woff2?v=3.19") format("woff2");
    font-display: swap;
    font-named-instance: "Regular";
  }

  @font-face {
    font-weight: 100 900;
    font-family: "Inter var";
    font-style: italic;
    src: url("/fonts/Inter-italic.var.woff2?v=3.19") format("woff2");
    font-display: swap;
    font-named-instance: "Italic";
  }

  html {
    box-sizing: border-box;
  }

  *,
  *:before,
  *:after {
    box-sizing: inherit;
  }

  body {
    margin: 0 auto;
    color: ${colors.text};
    font-weight: ${fontWeights.medium};
    font-size: 16px;
    font-family: ${fonts.body};
    line-height: ${lineHeights.default};
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.05);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "cv01", "cv02", "cv03", "cv04", "cv06", "cv07",
      "cv08", "cv09", "calt", "ccmp", "kern";
    scroll-behavior: smooth;
  }
`

const Viewport = styled(`div`)`
  width: 100%;
`

const rainbow = keyframes`
  0% {
    background-position: 1% 80%
  }
  50% {
    background-position: 99% 20%
  }
  100% {
    background-position: 1% 80%
  }
`

const Overlay = styled(`div`)`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: block;
  background: ${gradients.overlay};
  opacity: 0.8;
  cursor: pointer;
  z-index: ${zIndices.overlay};
  animation: ${rainbow} 20s ease-in-out infinite;
  background-size: 1000% 1000%;
`

export default class Layout extends React.Component {
  desktopMediaQuery

  state = {
    interface: {
      ...defaultInterfaceContext,
      toggleCart: () => {
        this.setState((state) => {
          return {
            interface: {
              ...state.interface,
              contributorAreaStatus:
                state.interface.isDesktopViewport === false &&
                state.interface.contributorAreaStatus === `open`
                  ? `closed`
                  : state.interface.contributorAreaStatus,
              cartStatus:
                this.state.interface.cartStatus === `open` ? `closed` : `open`,
            },
          }
        })
      },
      toggleProductImagesBrowser: (img) => {
        this.setState((state) => {
          return {
            interface: {
              ...state.interface,
              productImagesBrowserStatus: img ? `open` : `closed`,
              productImageFeatured: img
                ? img
                : state.interface.productImageFeatured,
            },
          }
        })
      },
      featureProductImage: (img) => {
        this.setState((state) => {
          return {
            interface: {
              ...state.interface,
              productImageFeatured: img,
            },
          }
        })
      },
      setCurrentProductImages: (images) => {
        this.setState((state) => {
          return {
            interface: {
              ...state.interface,
              currentProductImages: images,
              productImageFeatured: null,
            },
          }
        })
      },
      toggleContributorArea: () => {
        this.setState((state) => {
          return {
            interface: {
              ...state.interface,
              contributorAreaStatus: this.toggleContributorAreaStatus(),
            },
          }
        })
      },
    },
    user: {
      ...defaultUserContext,
      handleLogout: () => {
        this.setState({
          user: {
            ...defaultUserContext,
            loading: false,
          },
        })
        logout(() => navigate(`/`))
      },
      updateContributor: (data) => {
        this.setState((state) => {
          return {
            user: {
              ...state.user,
              contributor: data,
              loading: false,
            },
          }
        })
      },
    },
    store: {
      ...defaultStoreContext,
      addVariantToCart: (variantId, quantity) => {
        if (variantId === `` || !quantity) {
          console.error(`Both a size and quantity are required.`)
          return
        }

        this.setState((state) => {
          return {
            store: {
              ...state.store,
              adding: true,
            },
          }
        })

        const { checkout, client } = this.state.store
        const checkoutId = checkout.id
        const lineItemsToUpdate = [
          { variantId, quantity: parseInt(quantity, 10) },
        ]

        return client.checkout
          .addLineItems(checkoutId, lineItemsToUpdate)
          .then((checkout) => {
            this.setState((state) => {
              return {
                store: {
                  ...state.store,
                  checkout,
                  adding: false,
                },
              }
            })
          })
      },
      removeLineItem: (client, checkoutID, lineItemID) =>
        client.checkout
          .removeLineItems(checkoutID, [lineItemID])
          .then((res) => {
            this.setState((state) => {
              return {
                store: {
                  ...state.store,
                  checkout: res,
                },
              }
            })
          }),
      updateLineItem: (client, checkoutID, lineItemID, quantity) => {
        const lineItemsToUpdate = [
          { id: lineItemID, quantity: parseInt(quantity, 10) },
        ]

        return client.checkout
          .updateLineItems(checkoutID, lineItemsToUpdate)
          .then((res) => {
            this.setState((state) => {
              return {
                store: {
                  ...state.store,
                  checkout: res,
                },
              }
            })
          })
      },
    },
  }

  async initializeCheckout() {
    // Check for an existing cart.
    const isBrowser = typeof window !== `undefined`
    const existingCheckoutID = isBrowser
      ? localStorage.getItem(`shopify_checkout_id`)
      : null

    const setCheckoutInState = (checkout) => {
      if (isBrowser) {
        localStorage.setItem(`shopify_checkout_id`, checkout.id)
      }

      this.setState((state) => {
        return {
          store: {
            ...state.store,
            checkout,
          },
        }
      })
    }

    const createNewCheckout = () => this.state.store.client.checkout.create()
    const fetchCheckout = (id) => this.state.store.client.checkout.fetch(id)

    if (existingCheckoutID && existingCheckoutID !== `null`) {
      try {
        const checkout = await fetchCheckout(existingCheckoutID)

        // Make sure this cart hasn’t already been purchased.
        if (!checkout.completedAt) {
          setCheckoutInState(checkout)
          return
        }
      } catch (e) {
        localStorage.setItem(`shopify_checkout_id`, null)
      }
    }

    const newCheckout = await createNewCheckout()
    setCheckoutInState(newCheckout)
  }

  async loadContributor(nickname) {
    try {
      const { data } = await client.mutate({
        mutation: gql`
          mutation ($user: String!) {
            updateContributorTags(githubUsername: $user) {
              email
              github {
                username
                contributionCount
                pullRequests {
                  id
                }
              }
              shopify {
                id
                codes {
                  code
                  used
                }
              }
            }
          }
        `,
        variables: { user: nickname },
      })

      this.setState((state) => {
        return {
          user: {
            ...state.user,
            contributor: data.updateContributorTags,
            loading: false,
          },
        }
      })
    } catch (error) {
      this.setState((state) => {
        return {
          user: {
            ...state.user,
            error: error.toString(),
            loading: false,
          },
        }
      })
    }
  }

  componentDidMount() {
    // Observe viewport switching from mobile to desktop and vice versa
    const mediaQueryToMatch = `(min-width: ${breakpoints.desktop}px)`

    this.desktopMediaQuery = window.matchMedia(mediaQueryToMatch)
    this.desktopMediaQuery.addListener(this.updateViewPortState)

    this.updateViewPortState()

    // Make sure we have a Shopify checkout created for cart management.
    this.initializeCheckout()

    // Mounting Layout on 'callback' page triggers user 'loading' flag
    if (this.props.location.pathname === `/callback/`) {
      this.setState((state) => {
        return {
          user: { ...state.user, loading: true },
        }
      })
    }

    // Make sure to set user.profile when a visitor reloads the app
    if (this.props.location.pathname !== `/callback/`) {
      this.setUserProfile()
    }
  }

  componentDidUpdate(prevProps) {
    // Set user.profile after redirection from '/callback/' to '/'
    if (
      prevProps.location.pathname !== this.props.location.pathname &&
      prevProps.location.pathname === `/callback/`
    ) {
      this.setState((state) => {
        return {
          interface: {
            ...state.interface,
            contributorAreaStatus: `open`,
          },
        }
      })
      this.setUserProfile()
    }

    // Close product modal window after navigating "back"
    if (
      prevProps.location.pathname !== this.props.location.pathname &&
      prevProps.location.pathname.startsWith(`/product/`)
    ) {
      this.setState((state) => {
        return {
          interface: {
            ...state.interface,
            productImagesBrowserStatus: `closed`,
          },
        }
      })
    }
  }

  componentWillUnmount = () => {
    this.desktopMediaQuery.removeListener(this.updateViewPortState)
  }

  updateViewPortState = (e) => {
    this.setState((state) => {
      return {
        interface: {
          ...state.interface,
          isDesktopViewport: this.desktopMediaQuery.matches,
        },
      }
    })
  }

  setUserProfile = () => {
    // Load the user info from Auth0.
    const profile = getUserInfo()

    // If logged in set user.profile
    if (profile && profile.nickname) {
      this.setState((state) => {
        return {
          user: {
            ...state.user,
            profile,
            loading: true,
          },
        }
      })

      // and load the contributor data
      this.loadContributor(profile.nickname)
    }
  }

  toggleContributorAreaStatus = () => {
    if (this.state.interface.contributorAreaStatus === `initial`) {
      return this.state.interface.isDesktopViewport ? `closed` : `open`
    } else {
      return this.state.interface.contributorAreaStatus === `closed`
        ? `open`
        : `closed`
    }
  }

  render() {
    const { children, location } = this.props

    return (
      <>
        <Global styles={globalStyles} />
        <SiteMetadata />
        <UserContext.Provider value={this.state.user}>
          <StoreContext.Provider value={this.state.store}>
            <InterfaceContext.Provider value={this.state.interface}>
              <InterfaceContext.Consumer>
                {({
                  isDesktopViewport,
                  cartStatus,
                  toggleCart,
                  contributorAreaStatus,
                  toggleContributorArea,
                  productImagesBrowserStatus,
                  currentProductImages,
                  featureProductImage,
                  productImageFeatured,
                  toggleProductImagesBrowser,
                }) => (
                  <>
                    {cartStatus === `open` && <Overlay onClick={toggleCart} />}

                    <Header
                      isDesktopViewport={isDesktopViewport}
                      productImagesBrowserStatus={productImagesBrowserStatus}
                    />

                    <Viewport>
                      <Cart
                        isDesktopViewport={isDesktopViewport}
                        status={cartStatus}
                        toggle={toggleCart}
                        contributorAreaStatus={contributorAreaStatus}
                        productImagesBrowserStatus={productImagesBrowserStatus}
                      />

                      <ContributorArea
                        location={location}
                        status={contributorAreaStatus}
                        toggle={toggleContributorArea}
                        isDesktopViewport={isDesktopViewport}
                        productImagesBrowserStatus={productImagesBrowserStatus}
                      />

                      <PageContent
                        cartStatus={cartStatus}
                        toggle={toggleCart}
                        contributorAreaStatus={contributorAreaStatus}
                        isDesktopViewport={isDesktopViewport}
                        productImagesBrowserStatus={productImagesBrowserStatus}
                        location={location}
                      >
                        {children}
                      </PageContent>

                      {currentProductImages.length > 0 && (
                        <ProductImagesBrowser
                          featureProductImage={featureProductImage}
                          images={currentProductImages}
                          position={productImagesBrowserStatus}
                          imageFeatured={productImageFeatured}
                          toggle={toggleProductImagesBrowser}
                          isDesktopViewport={isDesktopViewport}
                        />
                      )}
                    </Viewport>
                  </>
                )}
              </InterfaceContext.Consumer>
            </InterfaceContext.Provider>
          </StoreContext.Provider>
        </UserContext.Provider>
      </>
    )
  }
}
