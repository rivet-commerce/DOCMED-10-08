if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]')
      }
      this.mql = window.matchMedia('(min-width: 768px)');
      if (!this.elements.thumbnails) return;

      this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
      this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
        mediaToSwitch.querySelector('button').addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
      });
      if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
      if (this.classList.contains('docmed-gallery')) this.initDocmedGallery();
    }

    initDocmedGallery() {
      this.querySelectorAll('[data-gallery-step]').forEach((button) => {
        button.addEventListener('click', () => this.stepMedia(Number(button.dataset.galleryStep)));
      });
      // Cap the desktop thumbnail column at the image box height
      new ResizeObserver(() => {
        this.style.setProperty('--dg-viewer-height', `${this.elements.viewer.offsetHeight}px`);
      }).observe(this.elements.viewer);
      this.moreButton = this.querySelector('.docmed-gallery__more');
      if (this.moreButton) {
        this.moreButton.addEventListener('click', () => {
          this.classList.add('docmed-gallery--expanded');
          this.updateDocmedGallery();
        });
      }
      this.updateDocmedGallery();
    }

    // Thumbnails of other variants' images are hidden by CSS (all but the first)
    getVisibleThumbnails() {
      return Array.from(this.elements.thumbnails.querySelectorAll('[data-target]')).filter(
        (item) => !item.classList.contains('thumbnail-list_item--variant') || item === item.parentElement.firstElementChild
      );
    }

    stepMedia(step) {
      const items = this.getVisibleThumbnails();
      if (items.length < 2) return;
      const current = items.findIndex((item) => item.querySelector('[aria-current]'));
      const next = items[(current + step + items.length) % items.length];
      this.setActiveMedia(next.dataset.target, false);
    }

    updateDocmedGallery() {
      const items = this.getVisibleThumbnails();
      const current = Math.max(0, items.findIndex((item) => item.querySelector('[aria-current]')));

      const dots = this.querySelector('.docmed-gallery__dots');
      if (dots) {
        if (dots.children.length !== items.length) dots.innerHTML = items.map(() => '<span></span>').join('');
        Array.from(dots.children).forEach((dot, index) => dot.classList.toggle('is-active', index === current));
      }

      // Desktop: show 4 thumbnails plus a "+N" tile when there are more than 5
      const limit = 5;
      const shown = limit - 1;
      let collapsed = items.length > limit && !this.classList.contains('docmed-gallery--expanded');
      if (collapsed && current >= shown) {
        this.classList.add('docmed-gallery--expanded');
        collapsed = false;
      }
      items.forEach((item, index) => item.classList.toggle('docmed-gallery__thumb--overflow', collapsed && index >= shown));
      if (this.moreButton) {
        this.moreButton.hidden = !collapsed;
        this.moreButton.querySelector('.docmed-gallery__more-count').textContent = `+${items.length - shown}`;
      }

      // Keep the active thumbnail in view in the vertical desktop column
      const list = items[current] && items[current].parentElement;
      if (list && list.scrollHeight > list.clientHeight + 1) {
        list.scrollTo({ top: items[current].offsetTop - (list.clientHeight - items[current].clientHeight) / 2, behavior: 'smooth' });
      }
    }

    // onSlideChanged(event) {
    //   const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${ event.detail.currentElement.dataset.mediaId }"]`);
    //   this.setActiveThumbnail(thumbnail);
    // }
    onSlideChanged(event) {
      if (!event.detail || !event.detail.currentElement) {
        return;
      }
      const currentElement = event.detail.currentElement;
      const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${ currentElement.dataset.mediaId }"]`);
      this.setActiveThumbnail(thumbnail);
    }
    
    setActiveMedia(mediaId, prepend) {
      const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${ mediaId }"]`);
      this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
        element.classList.remove('is-active');
      });
      activeMedia.classList.add('is-active');

      if (prepend) {
        activeMedia.parentElement.prepend(activeMedia);
        if (this.elements.thumbnails) {
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
          activeThumbnail.parentElement.prepend(activeThumbnail);
        }
        if (this.elements.viewer.slider) this.elements.viewer.resetPages();
      }

      this.preventStickyHeader();
      window.setTimeout(() => {
        if (this.elements.thumbnails) {
          activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
        }
        if (!this.elements.thumbnails || this.dataset.desktopLayout === 'stacked') {
          activeMedia.scrollIntoView({behavior: 'smooth'});
        }
      });
      this.playActiveMedia(activeMedia);

      if (!this.elements.thumbnails) return;
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
      this.setActiveThumbnail(activeThumbnail);
      this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      thumbnail.querySelector('button').setAttribute('aria-current', true);
      if (this.classList.contains('docmed-gallery')) this.updateDocmedGallery();
      if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

      this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image) return;
      image.onload = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
      };
      image.src = image.src;
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia();
      const deferredMedia = activeItem.querySelector('.deferred-media');
      if (deferredMedia) deferredMedia.loadContent(false);
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
    }
  });
}
