import * as React from 'react'
import { aboutIITC, androidPermalink, setPermaLink } from '../code/utils_misc'

class SideBar extends React.Component {
  render() {

    return (
      <div>
        <a id="sidebartoggle" accessKey="i" title="Toggle sidebar [i]">
          <span className="toggle close" />
        </a>
        <div id="scrollwrapper">
          <div id="sidebar" /* style={{ display: 'none' }} */>
            <div id="playerstat">t</div>
            <div id="gamestat">&nbsp;loading global control stats</div>
            <div id="searchwrapper">
              <button title="Current location" id="buttongeolocation">
                <img src="@include_img:images/current-location.png@"
                  alt="Current location" />
              </button>
              <input id="search" placeholder="Search location…" type="search" accessKey="f" title="Search for a place [f]" />
            </div>
            <div id="portaldetails" >
              <input id="redeem" placeholder="Redeem code…" type="text" />
             {/*  <div id="toolbox">
                <a onMouseOver={()=>setPermaLink(this)} onClick={() => { setPermaLink(this); return androidPermalink() }} title="URL link to this map view">Permalink</a>
                <a onClick={aboutIITC} style={{ cursor: 'help' }}>About IITC</a> 
              </div> */}
            </div>
          </div>
        </div>
      </div>
      )
  }
}

export default SideBar