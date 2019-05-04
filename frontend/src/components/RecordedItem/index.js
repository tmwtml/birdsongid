/**
 * RecordedItem
 */

import React     from 'react';
import PropTypes from 'prop-types';
import moment    from 'moment';

/* component styles */
import { styles } from './styles.scss';

export default function RecordedItem(props) {
  const { onTouchTap } = props;
  const { title, detail, blob, startTime, stopTime, createdAt } = props.item;
  const totalSize = (blob.size/1000000).toFixed(2);
  const length = ((moment.duration(stopTime - startTime)
                  .asSeconds())/60).toFixed(2)
                  .replace('.',':');

  return (
    <div className={styles} onTouchTap={goToDetailsView.bind(null, onTouchTap)}>
      <div className="item">
        <h2 className="title">{title || 'Recording X'}</h2>
        <div className="length">{createdAt}</div>
        <div className="created-at">{detail}</div>
        {/* <div className="length">{length}</div>
        <div className="size">{totalSize} MB</div> */}
      </div>
    </div>
  );
}

function goToDetailsView(onTouchTap) {
  onTouchTap();
}

RecordedItem.propTypes = {
  item: PropTypes.object.isRequired
};
