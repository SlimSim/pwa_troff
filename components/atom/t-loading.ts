import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Loading indicator: spoon stirring in a glass cup.
 * Monochrome `currentColor` on a transparent background.
 */
@customElement('t-loading')
export class TLoading extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--t-loading-size, 1em);
      height: var(--t-loading-size, 1em);
      color: currentColor;
      background: transparent;
      --stir-duration: 1.6s;
    }

    .loader {
      display: inline-flex;
      width: 100%;
      height: 100%;
    }

    svg {
      width: 100%;
      height: 100%;
      background: transparent;
    }

    .spoon-orbit {
      animation: spoon-orbit var(--stir-duration) linear infinite;
      transform-box: fill-box;
      transform-origin: 50% 90%;
    }

    .spoon-tilt {
      animation: spoon-tilt var(--stir-duration) linear infinite;
      transform-box: fill-box;
      transform-origin: 9% 95%;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @keyframes spoon-tilt {
      0% {
        transform: rotate(-1.59deg) scale(1.14);
      }
      3.13% {
        transform: rotate(-1.03deg) scale(1.1);
      }
      6.25% {
        transform: rotate(-1.49deg) scale(1.05);
      }
      9.38% {
        transform: rotate(-3.12deg) scale(0.99);
      }
      12.5% {
        transform: rotate(-6.08deg) scale(0.93);
      }
      15.63% {
        transform: rotate(-10.55deg) scale(0.87);
      }
      18.75% {
        transform: rotate(-16.58deg) scale(0.82);
      }
      21.88% {
        transform: rotate(-24.02deg) scale(0.79);
      }
      25% {
        transform: rotate(-32.3deg) scale(0.78);
      }
      28.13% {
        transform: rotate(-40.58deg) scale(0.79);
      }
      31.25% {
        transform: rotate(-48.02deg) scale(0.82);
      }
      34.38% {
        transform: rotate(-54.05deg) scale(0.87);
      }
      37.5% {
        transform: rotate(-58.52deg) scale(0.93);
      }
      40.63% {
        transform: rotate(-61.48deg) scale(0.99);
      }
      43.75% {
        transform: rotate(-63.11deg) scale(1.05);
      }
      46.88% {
        transform: rotate(-63.57deg) scale(1.1);
      }
      50% {
        transform: rotate(-63.01deg) scale(1.14);
      }
      53.13% {
        transform: rotate(-61.55deg) scale(1.17);
      }
      56.25% {
        transform: rotate(-59.25deg) scale(1.19);
      }
      59.38% {
        transform: rotate(-56.18deg) scale(1.2);
      }
      62.5% {
        transform: rotate(-52.41deg) scale(1.2);
      }
      65.63% {
        transform: rotate(-48.02deg) scale(1.2);
      }
      68.75% {
        transform: rotate(-43.1deg) scale(1.19);
      }
      71.88% {
        transform: rotate(-37.8deg) scale(1.19);
      }
      75% {
        transform: rotate(-32.3deg) scale(1.19);
      }
      78.13% {
        transform: rotate(-26.8deg) scale(1.19);
      }
      81.25% {
        transform: rotate(-21.5deg) scale(1.19);
      }
      84.38% {
        transform: rotate(-16.58deg) scale(1.2);
      }
      87.5% {
        transform: rotate(-12.19deg) scale(1.2);
      }
      90.63% {
        transform: rotate(-8.42deg) scale(1.2);
      }
      93.75% {
        transform: rotate(-5.35deg) scale(1.19);
      }
      96.88% {
        transform: rotate(-3.05deg) scale(1.17);
      }
      100% {
        transform: rotate(-1.59deg) scale(1.14);
      }
    }

    @keyframes spoon-orbit {
      0% {
        transform: translate(-21px, 0px);
      }
      3.13% {
        transform: translate(-22px, 2.93px);
      }
      6.25% {
        transform: translate(-24.96px, 5.74px);
      }
      9.38% {
        transform: translate(-29.76px, 8.33px);
      }
      12.5% {
        transform: translate(-36.23px, 10.61px);
      }
      15.63% {
        transform: translate(-44.11px, 12.47px);
      }
      18.75% {
        transform: translate(-53.1px, 13.86px);
      }
      21.88% {
        transform: translate(-62.86px, 14.71px);
      }
      25% {
        transform: translate(-73px, 15px);
      }
      28.13% {
        transform: translate(-83.14px, 14.71px);
      }
      31.25% {
        transform: translate(-92.9px, 13.86px);
      }
      34.38% {
        transform: translate(-101.89px, 12.47px);
      }
      37.5% {
        transform: translate(-109.77px, 10.61px);
      }
      40.63% {
        transform: translate(-116.24px, 8.33px);
      }
      43.75% {
        transform: translate(-121.04px, 5.74px);
      }
      46.88% {
        transform: translate(-124px, 2.93px);
      }
      50% {
        transform: translate(-125px, 0px);
      }
      53.13% {
        transform: translate(-124px, -2.93px);
      }
      56.25% {
        transform: translate(-121.04px, -5.74px);
      }
      59.38% {
        transform: translate(-116.24px, -8.33px);
      }
      62.5% {
        transform: translate(-109.77px, -10.61px);
      }
      65.63% {
        transform: translate(-101.89px, -12.47px);
      }
      68.75% {
        transform: translate(-92.9px, -13.86px);
      }
      71.88% {
        transform: translate(-83.14px, -14.71px);
      }
      75% {
        transform: translate(-73px, -15px);
      }
      78.13% {
        transform: translate(-62.86px, -14.71px);
      }
      81.25% {
        transform: translate(-53.1px, -13.86px);
      }
      84.38% {
        transform: translate(-44.11px, -12.47px);
      }
      87.5% {
        transform: translate(-36.23px, -10.61px);
      }
      90.63% {
        transform: translate(-29.76px, -8.33px);
      }
      93.75% {
        transform: translate(-24.96px, -5.74px);
      }
      96.88% {
        transform: translate(-22px, -2.93px);
      }
      100% {
        transform: translate(-21px, 0px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spoon,
      .spoon-orbit,
      .spoon-tilt {
        animation: none;
      }
    }
  `;

  @property({ type: String }) label = 'Loading';

  render() {
    return html`
      <div class="loader" role="status" aria-live="polite">
        <svg viewBox="0 0 289.64 289.64" aria-hidden="true">
          <g transform="translate(-443.57 -370.58)">
            <g transform="matrix(.61531 0 0 .61531 389.48 205.35)">
              <g
                class="cup"
                id="cup"
                fill="currentColor"
                stroke="none"
              >
                <path
                  d="m 247.88106,536.82523 c -15.59841,3.61225 -29.88512,8.28153 -42.43279,13.83958 -31.68723,14.03601 -53.12352,32.24692 -53.12352,55.85336 0,23.60643 21.43629,43.9853 53.12352,58.02131 31.68724,14.03602 74.40114,22.37495 121.48007,22.37495 47.07893,0 89.84044,-8.33893 121.52767,-22.37495 31.68723,-14.03601 53.12035,-34.41488 53.12035,-58.02131 0,-23.60644 -21.43312,-41.81735 -53.12035,-55.85336 -11.37559,-5.03889 -24.1881,-9.35236 -38.10318,-12.80477 0.009,0.0784 0.0352,0.15692 0.0444,0.23491 -81.12898,-0.28448 -81.93119,-0.48805 -162.51621,-1.26972 z m 169.00113,14.1126 c 1.19229,-0.0269 2.37337,0.19597 3.54239,0.75536 l 53.09496,35.44642 c 0.98067,1.01926 1.33155,2.23227 0.51105,3.8122 l -24.67628,17.96291 -14.46487,0.31734 -49.00975,-32.90067 c -1.14109,-1.29381 -1.07068,-2.73284 0,-4.29148 l 27.39976,-20.34672 c 1.20901,-0.44947 2.41042,-0.72788 3.60274,-0.75536 z"
                ></path>
                <g class="liquid" id="liquid">
                  <path
                    d="m 418.28486,410.40947 c -33.72396,-8.98637 -43.56519,-17.89709 -89.21972,-18.34305 -48.07642,-0.46642 -59.19107,7.6804 -89.93196,18.82432 21.44124,13.00412 50.88914,19.50858 91.12658,20.41466 32.8207,-0.76085 66.0317,-7.06466 88.0251,-20.89593 z"
                  ></path>
                  <ellipse
                    cx="327.8569"
                    cy="383.75558"
                    rx="109.62001"
                    ry="43.000465"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="5.2675"
                  ></ellipse>
                </g>
                <path
                  d="m 276.95735,427.64205 c 37.96874,8.45926 69.04038,9.52786 108.48936,-1.62834 35.69655,-10.73373 44.36485,-20.14548 53.78829,-36.45333 -1.79314,10.74314 -9.92214,19.87625 -14.07486,30.07176 -15.04456,29.14881 -17.88755,62.31257 -14.92639,94.326 4.89202,23.67074 14.91273,41.52152 13.55495,66.23514 -0.83886,26.84194 -8.27515,37.21519 -25.53204,56.91764 -9.86719,8.35764 -21.64247,16.34358 -36.9708,19.52775 -18.14672,3.73187 -40.53473,2.64924 -61.65765,-0.33417 -14.54515,-2.57288 -30.04026,-11.57609 -40.10506,-21.22859 -12.16651,-17.49486 -19.44561,-26.64761 -22.55947,-58.57229 -2.74953,-22.2268 6.92402,-43.25544 10.8868,-64.75273 3.77623,-41.6015 -8.54255,-81.87821 -29.71754,-118.16359 20.76302,24.63797 39.79304,29.64131 58.82441,34.05475 z"
                ></path>
              </g>
              <g
                class="spoon"
                id="spoon"
                fill="currentColor"
                stroke="none"
              >
                <g class="spoon-orbit">
                  <g class="spoon-tilt">
                    <path
                      d="m 406.21364,415.86345 c 50.43835,-71.22484 49.83932,-71.1962 52.23973,-75.43104 5.4041,-9.53402 1.20091,-14.58144 -2.40184,-16.82476 -3.60274,-2.2433 -8.75368,-3.82147 -13.21004,2.80413 -3.70228,5.50444 -43.83333,76.83305 -47.43607,79.63722 z"
                    ></path>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>
        <span class="sr-only">${this.label}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-loading': TLoading;
  }
}
